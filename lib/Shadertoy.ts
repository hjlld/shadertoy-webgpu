import vxCode from './shader/vertex.wgsl';
import { fxCodeHeader, fxCodeMain, iChannelOptions } from './shader/fragment.glsl';
import glslangModule, { Glslang } from '@webgpu/glslang/dist/web-devel-onefile/glslang';

type boolString = "true" | "false";

interface ShadertoyResponseInput {

    channel: number,
    ctype: string,
    id: number,
    published: 1 | 0,
    sampler: {
        filter: GPUFilterMode,
        internal: string,
        srgb: boolString,
        vflip: boolString,
        wrap: string
    },
    src: string

}

interface ShadertoyResponseRenderpass {

    code: string,
    description: string,
    inputs: ShadertoyResponseInput[],
    name: string,
    outputs: any[],
    type: string

}

interface ShadertoyResponseShader {

    ver: string;
    info: any;
    renderpass: ShadertoyResponseRenderpass[]

}

interface iChannel extends iChannelOptions {

    src: string,
    data?: ArrayBuffer,
    sampler: GPUSampler,
    texture: GPUTexture,
    ctype: string
}

type TypedArray = Float32Array | Float64Array | Uint8Array | Uint8ClampedArray | Int8Array | Int16Array | Int32Array;

export class Shadertoy {

    public appKey: string = 'NdnKMm';

    public canvas: HTMLCanvasElement;

    public context: GPUCanvasContext;

    public adapter: GPUAdapter;

    public device: GPUDevice;

    public format: GPUTextureFormat;

    public bundleEncoder: GPURenderBundleEncoder;

    public renderBundles: GPURenderBundle[] = [];

    public shadertoyCode: string;

    public glslCompiler: Glslang;

    public channels: iChannel[] = [];

    public userDefinedChannelUrls: string[] = [];

    public static readonly CTYPE = {

        MUSIC: 'music',
        TEXTURE: 'texture',

    };

    private _uniformBuffer: GPUBuffer;

    private _mouseDown: boolean = false;

    private __iResolutionArray: Float32Array = new Float32Array( [ 0, 0, 0 ] );

    private get _iResolutionArray(): Float32Array {

        const width = this.canvas.width;
        const height = this.canvas.height;

        this.__iResolutionArray[ 0 ] = width;
        this.__iResolutionArray[ 1 ] = height;
        this.__iResolutionArray[ 2 ] = width / height;

        return this.__iResolutionArray;

    }

    private __iTimeArray: Float32Array = new Float32Array( [ 0 ] );

    private get _iTimeArray(): Float32Array {

        this.__iTimeArray[ 0 ] += ( performance.now() - this._lastFrameTime ) / 1000;

        return this.__iTimeArray;

    }

    private _lastFrameTime: number = 0;

    private _iMouseArray: Float32Array = new Float32Array( [ 0, 0, 0, 0 ] );

    private __iUniformArray: Float32Array;

    private get _iUniformArray(): Float32Array {

        return this._MergeUniformArrays( 
            
            this._iResolutionArray, 
            this._iTimeArray,
            this._iMouseArray,

        );

    }

    private _vertexArray = new Float32Array([

        -1.0,  1.0,  0.0,
        -1.0, -1.0,  0.0,
         1.0, -1.0,  0.0,
         1.0,  1.0,  0.0,
        -1.0,  1.0,  0.0,
         1.0, -1.0,  0.0,

    ]);

    private _raf: number;

    constructor( rootElement: HTMLElement, appKey: string = 'NdnKMm' ) {

        this.canvas = document.createElementNS( 'http://www.w3.org/1999/xhtml', 'canvas' ) as HTMLCanvasElement;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.width = rootElement.clientWidth * window.devicePixelRatio;
        this.canvas.height = rootElement.clientHeight * window.devicePixelRatio;

        this.canvas.addEventListener( 'mousedown', ( e: MouseEvent ) => {

            this._mouseDown = true;

            this._iMouseArray[ 0 ] = e.clientX;
            this._iMouseArray[ 1 ] = e.clientY;
            this._iMouseArray[ 2 ] = e.clientX;
            this._iMouseArray[ 3 ] = -e.clientY;

        }, false );

        this.canvas.addEventListener( 'mouseup', () => {

            this._mouseDown = false;

            this._iMouseArray[ 3 ] = - this._iMouseArray[ 3 ];

        }, false );

        this.canvas.addEventListener( 'mousemove', ( e: MouseEvent ) => {

            if ( !this._mouseDown ) return;

            this._iMouseArray[ 0 ] = e.clientX;
            this._iMouseArray[ 1 ] = e.clientY;

        }, false );

        rootElement.appendChild( this.canvas );

        this.appKey = appKey;
        
    }

    public SetInputMedia( ...url: string[]) {

        this.userDefinedChannelUrls.push( ...url );

    }

    public async InitWebGPU() {

        const context = <unknown>this.canvas.getContext( 'webgpu' );

        if ( !context ) {

            throw new Error( 'WebGPU not supported!' );

        }

        this.glslCompiler = await glslangModule();

        this.context = context as GPUCanvasContext;

        this.adapter = await navigator.gpu.requestAdapter({

            powerPreference: 'high-performance'

        }) as GPUAdapter;

        this.device = await this.adapter.requestDevice() as GPUDevice;

        this.format = this.context.getPreferredFormat( this.adapter );

        this.context.configure({

            device: this.device,
            format: this.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT

        });

    }

    public static async Create( rootElement: HTMLElement, appKey?: string ) : Promise<Shadertoy> {

        const instance = new Shadertoy( rootElement, appKey );

        await instance.InitWebGPU();

        return instance;

    }

    public GetCodeByID( id: string ) {

        return fetch( `https://www.shadertoy.com/api/v1/shaders/${id}?key=${this.appKey}` )

        .then( res => {

            if ( res.status >= 400 ) throw new Error( `Bad Response from server: ${res.statusText}` );

            return res.json();

        })

        .then( async data => {

            const shader = data.Shader as ShadertoyResponseShader;

            // TODO: For-loop here to support multiple input buffers.
            const renderpass = shader.renderpass[ 0 ];

            const code = renderpass.code;

            for ( let j = 0; j < renderpass.inputs.length; j ++ ) {

                const input = renderpass.inputs[ j ];
                const src = this.userDefinedChannelUrls[ j ];
                const originSrc = `https://www.shadertoy.com${input.src}`;

                console.warn( `Find input media: ${originSrc}, due to Shadertoy's CORS policy we cannot read it directly. So before calling GetCodeByID(), you should download it (simply click the url) and call SetInputMedia(yourMediaUrl) in sequence to set media resources.`);

                const ctype = input.ctype;

                switch ( ctype ) {

                    case Shadertoy.CTYPE.MUSIC: {

                        const raw = await this._Fetch( src ).then( res => res.arrayBuffer() );

                        const audioData = await this._DecodeAudio( raw );
        
                        const sampler = this.device.createSampler({
        
                            minFilter: input.sampler.filter,
                            magFilter: input.sampler.filter,
                            addressModeU: 'clamp-to-edge',
                            addressModeV: 'clamp-to-edge',
                            addressModeW: 'repeat',
                            maxAnisotropy: 1,
                            mipmapFilter: input.sampler.filter
        
                        });
        
                        const texture = this.device.createTexture({

                            size: {
                                width: 512,
                                height: 2
                            },
                            format: 'r8unorm',
                            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING

                        });

                        const channel: iChannel = {

                            name: `iChannel${input.channel}`,
                            type: 'sampler2D',
                            src,
                            data: audioData,
                            sampler,
                            texture, 
                            ctype
        
                        };
        
                        this.channels.push( channel );

                        break;

                    }
                        
                    case Shadertoy.CTYPE.TEXTURE: {

                        if ( !( [ 'nearest', 'linear' ].includes( input.sampler.filter ) ) ) {

                            input.sampler.filter = 'linear';

                        } 

                        const { texture, sampler } = await this._LoadTexture( src, input.sampler.filter );

                        const channel: iChannel = {

                            name: `iChannel${input.channel}`,
                            type: 'sampler2D',
                            src,
                            sampler,
                            texture, 
                            ctype
        
                        };
        
                        this.channels.push( channel );

                        break;
                    }
                
                    default: {

                        break;
                    }

                }






            }

            this.SetCode( code );

        })

    }

    public SetCode( code: string ) {

        const parsed = this._ParseShader( code );

        this.shadertoyCode = parsed;

    }

    public async InitRenderer() {

        this.bundleEncoder = this.device.createRenderBundleEncoder({

            colorFormats: [ this.format ]

        });

        const layoutEntries: GPUBindGroupLayoutEntry[] = [{

            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' }

        }];

        const textureCommandEncoder = this.device.createCommandEncoder();

        for ( let i = 0; i < this.channels.length; i ++ ) {

            const channel = this.channels[ i ];

            switch ( channel.ctype ) {

                case Shadertoy.CTYPE.MUSIC: {

                    const buffer = this._CreateGPUBuffer( new Uint8Array( channel.data! ), GPUBufferUsage.COPY_SRC );

                    const size: GPUExtent3DStrict = {
        
                        width: 512,
                        height: 2,
        
                    }
        
                    textureCommandEncoder.copyBufferToTexture( { buffer, bytesPerRow: 512 * 4 }, { texture: channel.texture }, size );

                    break;
                }
                    
                case Shadertoy.CTYPE.TEXTURE: {




                    break;

                }
            
                default:
                    break;

            }

            const samplerEntry: GPUBindGroupLayoutEntry = {

                binding: i * 2 + 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: 'filtering' }
                
            };

            const textureEntry: GPUBindGroupLayoutEntry = {

                binding: i * 2 + 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: 'float' }

            }

            layoutEntries.push( samplerEntry, textureEntry );



        }

        this.device.queue.submit( [ textureCommandEncoder.finish() ] );

        const uniformGroupLayout = this.device.createBindGroupLayout( { entries: layoutEntries } );

        const pipelineLayout = this.device.createPipelineLayout({

            bindGroupLayouts: [ uniformGroupLayout ]

        });

        const vxModule = this.device.createShaderModule({

            code: vxCode

        });

        const fxModule = this.device.createShaderModule({

            code: this.glslCompiler.compileGLSL( this.shadertoyCode, 'fragment', false )

        });

        const pipeline = await this.device.createRenderPipelineAsync({

            layout: pipelineLayout,

            vertex: {

                buffers: [

                    {
                        arrayStride: 4 * 3,
                        attributes: [

                            // position
                            {

                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x3'

                            }

                        ],
                        stepMode: 'vertex'

                    }

                ],
                module: vxModule,
                entryPoint: 'main'
                
            },

            fragment: {

                module: fxModule,
                entryPoint: 'main',
                targets: [{

                    format: this.format

                }]

            },

            primitive: {

                topology: 'triangle-list'

            }

        });

        this.bundleEncoder.setPipeline( pipeline );

        const vertexBuffer = this._CreateGPUBuffer( this._vertexArray, GPUBufferUsage.VERTEX );

        this.bundleEncoder.setVertexBuffer( 0, vertexBuffer );

        this._uniformBuffer = this._CreateGPUBuffer( this._iUniformArray, GPUBufferUsage.UNIFORM );

        const groupEntries: GPUBindGroupEntry[] = [ 

            {

                binding: 0,
                resource: { buffer: this._uniformBuffer }

            }

        ];

        for ( let i = 0; i < this.channels.length; i ++ ) {

            const channel = this.channels[ i ];

            const samplerEntry: GPUBindGroupEntry = {

                binding: i * 2 + 1,
                resource: channel.sampler

            };

            const textureEntry: GPUBindGroupEntry = {

                binding: i * 2 + 2,
                resource: channel.texture.createView()

            };

            groupEntries.push( samplerEntry, textureEntry );

        }

        let uniformBindGroup = this.device.createBindGroup( {

            layout: uniformGroupLayout,

            entries: groupEntries

        } );

        this.bundleEncoder.setBindGroup( 0, uniformBindGroup );

        this.bundleEncoder.draw( 6 );

        this.renderBundles.push( this.bundleEncoder.finish() );

    }

    public Render() {

        this._raf = requestAnimationFrame( () => this.Render() );

        this.device.queue.writeBuffer( this._uniformBuffer, 0, this._iUniformArray );

        const commandEncoder = this.device.createCommandEncoder();

        const renderPassDescriptor : GPURenderPassDescriptor = {

            colorAttachments: [

                {

                    view: this.context.getCurrentTexture().createView(),
                    loadValue: { r: 0, g: 0, b: 0, a: 1 },
                    storeOp: 'store'

                }

            ]

        };

        const renderPassEncoder = commandEncoder.beginRenderPass( renderPassDescriptor );

        renderPassEncoder.executeBundles( this.renderBundles );

        renderPassEncoder.endPass();

        this.device.queue.submit( [ commandEncoder.finish() ] );

        this._lastFrameTime = performance.now();

    }

    public StopRender( clearCache: boolean = true ) {

        cancelAnimationFrame( this._raf );

        if ( clearCache ) {

            this.channels.length = 0;

            this._lastFrameTime = 0;

        }

    }

    public Dispose() {

        this.device.destroy();

    }

    private _ParseShader( shader: string ) {

        this.channels.forEach( ( channel: iChannel, i: number) => {

            shader = shader.replaceAll( new RegExp(`iChannel${i}`, 'g'), `sampler2D(${channel.name}_tex, ${channel.name}_sampler)` );

        });

        return `${ fxCodeHeader( this.channels ) }${ shader }${ fxCodeMain() }`;

    }

    private _CreateGPUBuffer( typedArray: TypedArray, usage: GPUBufferUsageFlags ) {

        let gpuBuffer = this.device.createBuffer( {

            size: typedArray.byteLength,

            usage: usage | GPUBufferUsage.COPY_DST,

            mappedAtCreation: true

        } );

        let constructor = typedArray.constructor as new ( buffer: ArrayBuffer ) => TypedArray;

        let view = new constructor( gpuBuffer.getMappedRange() );

        view.set( typedArray, 0 );

        gpuBuffer.unmap();

        return gpuBuffer;

    }

    private async _DecodeAudio( buffer: ArrayBuffer ): Promise<ArrayBuffer>{

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData( buffer );
        const right = audioBuffer.getChannelData( 1 );

        return right.buffer;

        // No need, Shadertoy only use the second channel.
        // interleaved

        // const [ left, right ] =  [ audioBuffer.getChannelData( 0 ), audioBuffer.getChannelData( 1 ) ];

        // const interleaved = new Float32Array(left.length + right.length)

        // for (let src = 0, dst = 0; src < left.length; src ++, dst += 2 ) {

        //   interleaved[ dst ] = left[src];
        //   interleaved[ dst + 1 ] = right[src];

        // }
        
        // return interleaved.buffer; 
        
    }

    private _Fetch( url: string ): Promise<Response> {

        return fetch( url )

        .then( res => {

            if ( res.status >= 400 ) throw new Error( `Bad response from server: ${res.statusText}`);

            return res;

        })

    }

    private _MergeUniformArrays( ...arrays: Float32Array[] ) {

        const length = arrays.reduce( ( pre: number, cur: Float32Array ) => {

            return pre + cur.length;

        }, 0 );

        if ( !this.__iUniformArray || this.__iUniformArray.length !== length ) {

            this.__iUniformArray = new Float32Array( { length } );

        }

        arrays.reduce( ( offset: number, cur: Float32Array ) => {

            this.__iUniformArray.set( cur, offset );

            return offset + cur.length;

        }, 0 );
        
        return this.__iUniformArray;

    }

    private _LoadTexture( url: string, filter: GPUFilterMode ) {

        let image = new Image();

        image.src = url;

        return image.decode()

        .then( () => {

            return createImageBitmap( image );

        })

        .then( ( bitmap: ImageBitmap ) => {

            let texture = this.device.createTexture( {

                size: {

                    width: image.naturalWidth,

                    height: image.naturalHeight,

                    depthOrArrayLayers: 1

                },

                format: 'rgba8unorm',

                usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT

            } );

            let source: GPUImageCopyExternalImage = {

                source: bitmap

            };

            let destination: GPUImageCopyTexture = {

                texture: texture

            };

            let copySize: GPUExtent3D = {

                width: image.naturalWidth,

                height: image.naturalHeight,

                depthOrArrayLayers: 1

            };

            this.device.queue.copyExternalImageToTexture( source, destination, copySize );

            bitmap.close();

            let sampler = this.device.createSampler( {

                magFilter: filter,

                minFilter: filter,

                mipmapFilter: filter,

                maxAnisotropy: 1

            } );

            return { texture, sampler };

        } );

    }

}