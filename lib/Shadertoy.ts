import glslangModule, { Glslang } from '@webgpu/glslang/dist/web-devel-onefile/glslang';
import { fxCode, fxCodeHeader, iChannelOptions } from './shader/fragment.glsl';
import vxCode from './shader/vertex.wgsl';

type TypedArray = Float32Array | Float64Array | Uint8Array | Uint8ClampedArray | Int8Array | Int16Array | Int32Array | Uint16Array | Uint32Array;
type ShadertoyRenderpassName = 'Common' | 'Buffer A' | 'Buffer B' | 'Buffer C' | 'Buffer D' | 'Image';
type BoolString = "true" | "false";
type ShadertoyRenderpassType = 'common' | 'image' | 'buffer';
type ShadertoyInputCtype = 'music' | 'texture';
type CopySoureGPUTexture = GPUTexture;
type CopyTargetGPUTexture = GPUTexture;

interface ShadertoyResponseInput {

    channel: number,
    ctype: ShadertoyInputCtype,
    id: number,
    published: 1 | 0,
    sampler: {
        filter: GPUFilterMode,
        internal: string,
        srgb: BoolString,
        vflip: BoolString,
        wrap: string
    },
    src: string

}

interface ShadertoyResponseRenderpass {

    code: string,
    description: string,
    inputs: ShadertoyResponseInput[],
    name: ShadertoyRenderpassName,
    outputs: any[],
    type: ShadertoyRenderpassType

}

interface ShadertoyResponseShader {

    ver: string;
    info: any;
    renderpass: ShadertoyResponseRenderpass[]

}

interface renderpassData {

    renderBundle: GPURenderBundle,
    renderTarget: GPUTexture | GPUCanvasContext,
    id: number

}

export class Shadertoy {

    public appKey: string = 'NdnKMm';

    public canvas: HTMLCanvasElement;

    public context: GPUCanvasContext;

    public adapter: GPUAdapter;

    public device: GPUDevice;

    public format: GPUTextureFormat;

    public renderpasses: Map<ShadertoyRenderpassName, renderpassData> = new Map();

    public glslCompiler: Glslang;

    public inputMedia: Map<ShadertoyRenderpassName, string[]> = new Map();

    public static readonly RENDERPASS: { [key: string]: ShadertoyRenderpassName } = {

        COMMON: 'Common',
        BUFFER_A: 'Buffer A',
        BUFFER_B: 'Buffer B',
        BUFFER_C: 'Buffer C',
        BUFFER_D: 'Buffer D',
        IMAGE: 'Image'

    };

    private pendingToCopyTextures: Map<CopySoureGPUTexture, CopyTargetGPUTexture> = new Map();

    private textures: Map<number, GPUTexture> = new Map();

    private _commonCode: string = '';

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

    private _iFrameArray: Uint32Array = new Uint32Array( [ 0 ] );

    private __iChannelResolutionArray: Float32Array = new Float32Array( { length: 12 } );

    private get _iChannelResolutionArray(): Float32Array {

        const width = this.canvas.width;
        const height = this.canvas.height;

        for ( let i = 0; i < this.__iChannelResolutionArray.length; i += 3 ) {

            this.__iChannelResolutionArray[ i ] = width;
            this.__iChannelResolutionArray[ i + 1 ] = height;
            this.__iChannelResolutionArray[ i + 2 ] = width / height;

        }
        
        return this.__iChannelResolutionArray;

    }

    private __iUniformArray: Uint8Array;

    private _iUniformArray(): Promise<Uint8Array> {

        return this._MergeUniformArrays( 
            
            this._iResolutionArray, 
            this._iTimeArray,
            this._iMouseArray,
            this._iFrameArray,
            this._iChannelResolutionArray,

        );

    }

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

    public async InitShaderByID( id: string ) {

        return fetch( `https://www.shadertoy.com/api/v1/shaders/${id}?key=${this.appKey}` )

        .then( res => {

            if ( res.status >= 400 ) throw new Error( `Bad Response from server: ${res.statusText}` );

            return res.json();

        })

        .then( async data => {

            if ( data.Error ) throw new Error( data.Error );

            if ( !this._uniformBuffer ) {

                const uniformArray = await this._iUniformArray();

                this._uniformBuffer = this._CreateGPUBuffer( uniformArray, GPUBufferUsage.UNIFORM );
    
            }

            const shader = data.Shader as ShadertoyResponseShader;

            for ( const renderpass of shader.renderpass ) {

                let name = renderpass.name;

                const type = renderpass.type;

                if ( !( Object.values( Shadertoy.RENDERPASS ).includes( name ) ) ) {

                    name = type.charAt( 0 ).toUpperCase() + type.slice( 1 ) as ShadertoyRenderpassName;

                }

            }

            this._SortRenderpass( shader.renderpass );

            for ( const renderpass of shader.renderpass ) {

                let binding = 0;

                const bundleEncoder = this.device.createRenderBundleEncoder({

                    colorFormats: [ this.format ]
    
                });
    
                const layoutEntries: GPUBindGroupLayoutEntry[] = [{
    
                    binding,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
    
                }];

                const groupEntries: GPUBindGroupEntry[] = [ 

                    {
                        binding,
                        resource: { buffer: this._uniformBuffer }
                    }

                ];

                const code = renderpass.code;

                // some shader only have one Image buffer, they don't have type and outputs property.
                const outputId = renderpass.outputs.length > 0 ? renderpass.outputs[ 0 ].id : -1;

                let name = renderpass.name;

                const type = renderpass.type;

                if ( !( Object.values( Shadertoy.RENDERPASS ).includes( name ) ) ) {

                    name = type.charAt( 0 ).toUpperCase() + type.slice( 1 ) as ShadertoyRenderpassName;

                }

                if ( name === 'Common' ) {

                    this._commonCode = code;

                    continue;

                }

                const channels: iChannelOptions[] = [];

                for ( const input of renderpass.inputs ) {

                    const ctype = input.ctype;

                    const src = this.GetInputMedia( name, input.channel );

                    const originSrc = input.src;

                    console.warn( `Find input media: https://www.shadertoy.com${originSrc}, due to Shadertoy's CORS policy we cannot read it directly. So before calling InitShaderByID(), you should download it manually (simply click the url) and call SetInputMedia() set media resources.`);

                    if ( ctype === 'music' ) {

                        if ( !src ) throw new Error( 'Media url not found!' );

                        const raw = await this._Fetch( src ).then( res => res.arrayBuffer() );

                        const audioData = await this._DecodeAudio( raw );

                        const layoutSamplerEntry: GPUBindGroupLayoutEntry = {
    
                            binding: ++binding,
                            visibility: GPUShaderStage.FRAGMENT,
                            sampler: { type: 'filtering' }
                            
                        };
            
                        const layoutTextureEntry: GPUBindGroupLayoutEntry = {
            
                            binding: ++binding,
                            visibility: GPUShaderStage.FRAGMENT,
                            texture: { sampleType: 'float' }
            
                        }

                        layoutEntries.push( layoutSamplerEntry, layoutTextureEntry );

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

                        this.textures.set( input.id, texture );

                        const groupSamplerEntry: GPUBindGroupEntry = {

                            binding: layoutSamplerEntry.binding,
                            resource: sampler
        
                        };
        
                        const groupTextureEntry: GPUBindGroupEntry = {
        
                            binding: layoutTextureEntry.binding,
                            resource: texture.createView()
        
                        };

                        groupEntries.push( groupSamplerEntry, groupTextureEntry );

                        const textureCommandEncoder = this.device.createCommandEncoder();

                        const buffer = this._CreateGPUBuffer( new Uint8Array( audioData ), GPUBufferUsage.COPY_SRC );

                        const size: GPUExtent3DStrict = {
            
                            width: 512,
                            height: 2,
            
                        }
            
                        textureCommandEncoder.copyBufferToTexture( { buffer, bytesPerRow: 512 * 4 }, { texture }, size );
    
                        this.device.queue.submit( [ textureCommandEncoder.finish() ] );

                        const channel: iChannelOptions = {

                            name: `iChannel${input.channel}`,
                            samplerBinding: layoutSamplerEntry.binding,
                            textureBinding: layoutTextureEntry.binding

                        }

                        channels.push( channel );

                    } else if ( ctype === 'texture' ) {

                        if ( !src ) throw new Error( 'Media url not found!' );

                        if ( !( [ 'linear', 'nearest' ].includes( input.sampler.filter ) ) ) {

                            input.sampler.filter = 'linear';

                        }

                        const { texture, sampler } = await this._LoadTexture( src, input.sampler.filter );

                        this.textures.set( input.id, texture );

                        const layoutSamplerEntry: GPUBindGroupLayoutEntry = {
    
                            binding: ++binding,
                            visibility: GPUShaderStage.FRAGMENT,
                            sampler: { type: 'filtering' }
                            
                        };
            
                        const layoutTextureEntry: GPUBindGroupLayoutEntry = {
            
                            binding: ++binding,
                            visibility: GPUShaderStage.FRAGMENT,
                            texture: { sampleType: 'float' }
            
                        }

                        layoutEntries.push( layoutSamplerEntry, layoutTextureEntry );

                        const groupSamplerEntry: GPUBindGroupEntry = {

                            binding: layoutSamplerEntry.binding,
                            resource: sampler
        
                        };
        
                        const groupTextureEntry: GPUBindGroupEntry = {
        
                            binding: layoutTextureEntry.binding,
                            resource: texture.createView()
        
                        };

                        groupEntries.push( groupSamplerEntry, groupTextureEntry );

                        const channel: iChannelOptions = {

                            name: `iChannel${input.channel}`,
                            samplerBinding: layoutSamplerEntry.binding,
                            textureBinding: layoutTextureEntry.binding

                        }

                        channels.push( channel );

                    } else if ( ctype === 'buffer') {

                        //TODO: support mipmap

                        if ( !( [ 'linear', 'nearest' ].includes( input.sampler.filter ) ) ) {

                            input.sampler.filter = 'linear';

                        }

                        const wrapMode = input.sampler.wrap === 'clamp' ? 'clamp-to-edge' : 'repeat';
                        
                        const sampler = this.device.createSampler({
        
                            minFilter: input.sampler.filter,
                            magFilter: input.sampler.filter,
                            addressModeU: wrapMode,
                            addressModeV: wrapMode,
                            addressModeW: wrapMode,
                            maxAnisotropy: 1,
                            mipmapFilter: input.sampler.filter
        
                        });

                        let texture: GPUTexture;

                        const inputRenderpass = Array.from( this.renderpasses.values() ).find( renderpassData => renderpassData.id === input.id );

                        if ( inputRenderpass ) {

                            texture = inputRenderpass.renderTarget as GPUTexture;

                        } else {

                            const width = this.canvas.width;
                            const height = this.canvas.height;

                            const usage =  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST;

                            texture = this._CreateRenderTarget( usage );

                            const blackData = new Uint8Array({ length: width * height * 4 });

                            for ( let i = 0; i < blackData.length; i += 4 ) {

                                blackData[ i ] = 0.0;
                                blackData[ i + 1 ] = 0.0;
                                blackData[ i + 2 ] = 0.0;
                                blackData[ i + 3 ] = 255.0;

                            }

                            const layout: GPUImageDataLayout = {
    
                                bytesPerRow: width * 4,
                                rowsPerImage: height,
                                offset: 0
                
                            };

                            const destination: GPUImageCopyTexture = { texture };
            
                            const copySize: GPUExtent3D = {
            
                                width,
                                height,
                                depthOrArrayLayers: 1
                
                            };

                            this.device.queue.writeTexture( destination, blackData.buffer, layout, copySize );

                        }

                        this.textures.set( input.id, texture );

                        const layoutSamplerEntry: GPUBindGroupLayoutEntry = {
    
                            binding: ++binding,
                            visibility: GPUShaderStage.FRAGMENT,
                            sampler: { type: 'filtering' }
                            
                        };
            
                        const layoutTextureEntry: GPUBindGroupLayoutEntry = {
            
                            binding: ++binding,
                            visibility: GPUShaderStage.FRAGMENT,
                            texture: { sampleType: 'float' }
            
                        }

                        layoutEntries.push( layoutSamplerEntry, layoutTextureEntry );

                        const groupSamplerEntry: GPUBindGroupEntry = {

                            binding: layoutSamplerEntry.binding,
                            resource: sampler
        
                        };
        
                        const groupTextureEntry: GPUBindGroupEntry = {
        
                            binding: layoutTextureEntry.binding,
                            resource: texture.createView()
        
                        };

                        groupEntries.push( groupSamplerEntry, groupTextureEntry );

                        const channel: iChannelOptions = {

                            name: `iChannel${input.channel}`,
                            samplerBinding: layoutSamplerEntry.binding,
                            textureBinding: layoutTextureEntry.binding

                        }

                        channels.push( channel );

                    }

                }

                const bindGroupLayout = this.device.createBindGroupLayout( { entries: layoutEntries } );

                const pipelineLayout = this.device.createPipelineLayout({
    
                    bindGroupLayouts: [ bindGroupLayout ]
    
                });
    
                const vxModule = this.device.createShaderModule({
    
                    code: vxCode
    
                });
    
                console.log(this._ParseShader( code, channels ))

                const fxModule = this.device.createShaderModule({
    
                    code: this.glslCompiler.compileGLSL( this._ParseShader( code, channels ), 'fragment', false )
    
                });

                const pipeline = await this.device.createRenderPipelineAsync({

                    layout: pipelineLayout,
    
                    vertex: {
    
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

                bundleEncoder.setPipeline( pipeline );

                const bindGroup = this.device.createBindGroup( {

                    layout: bindGroupLayout,

                    entries: groupEntries

                } );

                bundleEncoder.setBindGroup( 0, bindGroup );

                bundleEncoder.draw( 6 );

                const renderBundle = bundleEncoder.finish();

                renderBundle.label = name;

                let renderTarget: GPUTexture | GPUCanvasContext;

                if ( name === 'Image' ) {

                    renderTarget = this.context;

                } else if ( this.textures.has( outputId ) ) {

                    renderTarget = this._CreateRenderTarget();
                    
                    const target = this.textures.get( outputId )!;

                    this.pendingToCopyTextures.set( renderTarget, target );

                } else {

                    renderTarget = this._CreateRenderTarget();

                }

                this.renderpasses.set( name, { renderBundle, renderTarget, id: outputId } );
                
            }

        })
    }

    public GetInputMedia(renderpassName: ShadertoyRenderpassName, channel: number ) {

        if ( !this.inputMedia.has( renderpassName ) ) return;

        const channels = this.inputMedia.get( renderpassName )!;

        if ( !Array.isArray( channels ) ) return;

        return channels[ channel ];

    }
    public SetInputMedia(renderpassName: ShadertoyRenderpassName, channel: number, url: string ) {

        if ( !this.inputMedia.has( renderpassName ) ) {

            this.inputMedia.set( renderpassName, [] );

        }

        const channels = this.inputMedia.get( renderpassName )!;

        channels[ channel ] = url;

    }

    public async Render() {

        this._raf = requestAnimationFrame( () => this.Render() );

        const uniformArray = await this._iUniformArray();

        this.device.queue.writeBuffer( this._uniformBuffer, 0, uniformArray );
                
        let i = 0;

        for ( const renderpassData of this.renderpasses.values() ) {

            this.device.pushErrorScope( 'validation' );

            const { renderBundle, renderTarget } = renderpassData;

            const view = renderTarget instanceof GPUCanvasContext ? renderTarget.getCurrentTexture().createView() : renderTarget.createView();

            const commandEncoder = this.device.createCommandEncoder();

            const renderPassDescriptor: GPURenderPassDescriptor = {

                colorAttachments: [{

                    view,
                    loadValue: { r: 0, g: 0, b: 0, a: 1 },
                    storeOp: 'store'

                }]

            };

            const renderPassEncoder = commandEncoder.beginRenderPass( renderPassDescriptor );

            renderPassEncoder.executeBundles( [ renderBundle ] );

            renderPassEncoder.endPass();

            this.device.queue.submit( [ commandEncoder.finish() ] );

            await this.device.popErrorScope().then( ( error: GPUError | null ) => { 
            
                if ( error ) {
    
                    console.error( `Error at frame ${this._iFrameArray[ 0 ]}, renderpass ${i}`);
                    console.error(error);
    
                    cancelAnimationFrame( this._raf );
    
                }
            
            });

            for ( const [ source, target ] of this.pendingToCopyTextures ) {

                const commandEncoder = this.device.createCommandEncoder();

                commandEncoder.copyTextureToTexture( { texture: source },  { texture: target }, { width: this.canvas.width, height: this.canvas.height } );

                this.device.queue.submit( [ commandEncoder.finish() ] );

            }
            

            i++;
        }

        this._iFrameArray[ 0 ] = this._iFrameArray[ 0 ] + 1;

        this._lastFrameTime = performance.now();

    }

    private async _MergeUniformArrays( ...arrays: TypedArray[] ): Promise<Uint8Array> {

        const blob = new Blob( arrays );

        const res = new Response( blob );

        const buffer = await res.arrayBuffer();

        this.__iUniformArray = new Uint8Array( buffer );

        return this.__iUniformArray;

    }

    private async _DecodeAudio( buffer: ArrayBuffer ): Promise<ArrayBuffer>{

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData( buffer );

        // Shadertoy only use the second channel.
        const right = audioBuffer.getChannelData( 1 );

        return right.buffer;

        // No need 
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

    private _CreateRenderTarget( usage: GPUTextureUsageFlags = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC ) {

        return this.device.createTexture({

            size: {

                width: this.canvas.width,
                height: this.canvas.height,
                depthOrArrayLayers: 1

            },
            format: this.format,
            usage

        });

    }

    private _ParseShader( shader: string, channels: iChannelOptions[] ) {

        channels.forEach( ( channel: iChannelOptions ) => {

            shader = shader.replaceAll( new RegExp(channel.name, 'g'), `sampler2D(${channel.name}_tex, ${channel.name}_sampler)` );

        });

        return `${ fxCodeHeader( channels ) }\n${ this._commonCode }\n${ shader }\n${ fxCode }`;

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
                format: this.format,
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

    private _SortRenderpass( renderpasses: ShadertoyResponseRenderpass[] ) {

        const nameAligned: ShadertoyRenderpassName[] = [ 'Common', 'Buffer A', 'Buffer B', 'Buffer C', 'Buffer D', 'Image' ];

        renderpasses.sort( ( a, b ) => {

            const idxA = nameAligned.indexOf( a.name );
            const idxB = nameAligned.indexOf( b.name );
            
            return idxA - idxB;

        });

        for ( const renderpass of renderpasses ) {

            renderpass.inputs.sort( ( a, b ) => {

                return a.channel - b.channel;

            });

        }

        return renderpasses;

    }

}