# Shadertoy-WebGPU

A Shadertoy renderer via WebGPU. 

You can render a Shadertoy work only by passing its ID. 

However if the author disallow to share his/her work via "public + api", you cannot render it in this library.

## Install

```
npm i hiwebgl-shadertoy-webgpu
```

## Guide

```javascript

import { Shadertoy } from 'hiwebgl-shadertoy-webgpu';

// 1. Get a root element
const app = document.querySelector( '#app' );

// 2. Use static `Create()` method to get an instance
const shadertoy = await Shadertoy.Create( app );

// 3. Set input media if needed

// Set media url as iChannel0 for Buffer A.
// shadertoy.SetInputMedia( Shadertoy.RENDERPASS.BUFFER_A, 0, '/media/channel1.jpg'); 

// 4. Init work...
await shadertoy.InitShaderByID( 'Ns3XWf' );

// 5. Start rendering
shadertoy.Render();
```

## Feature

- [x] Uniforms - iResolution, iTime, iFrame, iChannelResolution, iMouse, iChannel0..3
- [x] Only one Image buffer
- [x] Multiple buffers - Commmon, Buffer A, Buffer B, Buffer C, Buffer D
- [x] Texture as input media
- [x] Sound as input media

## TODO

- Cubemap and cubemap buffer
- More uniforms - iTimeDelta, iChannelTime, iDate, iSampleRate
- More input media - video, keyboard, webcam, microphone, soundcloud...
- More...

## Dev

`npm install`

`npm run dev`

## Known issue

1. Not suport `sampler2D` as an independent variable in any form. Becasue WGSL doesn't support combined texture with sampler (for now), and GLSL spec disallow use them mixing together, see https://github.com/gpuweb/gpuweb/issues/770 and https://github.com/KhronosGroup/glslang/issues/2746#issuecomment-956192711

2. Due to Shadertoy's CORS policy we cannot fetch input media (texture, music...) directly. So before calling InitShaderByID(), you should download it manually. When input media detected, a warning in your browser console should be thrown, just click the media's url, then next call SetInputMedia() to set media resources.


