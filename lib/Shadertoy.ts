import vxCode from './shader/vertex.wgsl';
import { fxCodeHeader, fxCodeMain } from './shader/fragment.glsl';
import glslangModule, { Glslang } from '@webgpu/glslang/dist/web-devel-onefile/glslang';

interface ShadertoyResponseRenderpass {

    code: string,
    description: string,
    inputs: any[],
    name: string,
    outputs: any[],
    type: string

}

interface ShadertoyResponseShader {

    ver: string;
    info: any;
    renderpass: ShadertoyResponseRenderpass[]

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

    public renderBundle: GPURenderBundle;

    public shadertoyCode: string;

    public glslCompiler: Glslang;

    private _uniformBuffer: GPUBuffer;

    private _mouseDown: boolean = false;

    private __iResolutionArray: Float32Array = new Float32Array( [ 0, 0, 0 ] );

    private get _iResolutionArray() {

        const width = this.canvas.width;
        const height = this.canvas.height;

        this.__iResolutionArray[ 0 ] = width;
        this.__iResolutionArray[ 1 ] = height;
        this.__iResolutionArray[ 2 ] = width / height;

        return this.__iResolutionArray;

    }

    private __iTimeArray: Float32Array = new Float32Array( [ 0 ] );

    private get _iTimeArray() {

        this.__iTimeArray[ 0 ] += ( performance.now() - this._lastFrameTime ) / 1000;

        return this.__iTimeArray;

    }

    private _lastFrameTime: number = 0;

    private _iMouseArray: Float32Array = new Float32Array( [ 0, 0, 0, 0 ] );

    private get _iUniformArray() {

        return new Float32Array( [

            ...this._iResolutionArray, 
            ...this._iTimeArray,
            ...this._iMouseArray
        
        ]);

    }

    private _vertexArray = new Float32Array([

        -1.0,  1.0,  0.0,
        -1.0, -1.0,  0.0,
         1.0, -1.0,  0.0,
         1.0,  1.0,  0.0,
        -1.0,  1.0,  0.0,
         1.0, -1.0,  0.0,

    ]);

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

    public GetCodeByID( id: string ){

        return fetch( `https://www.shadertoy.com/api/v1/shaders/${id}?key=${this.appKey}` )

        .then( res => {

            if ( res.status >= 400 ) throw new Error( `Bad Response from server: ${res.statusText}` );

            return res.json();

        })

        .then( data => {

            const shader = data.Shader as ShadertoyResponseShader;

            this.SetCode( shader.renderpass[0].code );

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

        const uniformGroupLayout = this.device.createBindGroupLayout({

            entries: [{

                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }

            }]

        });

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

        let uniformBindGroup = this.device.createBindGroup( {

            layout: uniformGroupLayout,

            entries: [ {

                binding: 0,

                resource: { buffer: this._uniformBuffer }

            } ]

        } );

        this.bundleEncoder.setBindGroup( 0, uniformBindGroup );

        this.bundleEncoder.draw( 6 );

        this.renderBundle = this.bundleEncoder.finish();

    }

    public Render() {

        requestAnimationFrame( () => this.Render() );

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

        renderPassEncoder.executeBundles( [ this.renderBundle ] );

        renderPassEncoder.endPass();

        this.device.queue.submit( [ commandEncoder.finish() ] );

        this._lastFrameTime = performance.now();

    }

    private _ParseShader( shader: string ) {

        return `${fxCodeHeader}${shader}${fxCodeMain}`;

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
}