export interface iChannelOptions {

    name: string,
    samplerBinding: number,
    textureBinding: number

}

export const fxCodeHeader = ( channels: iChannelOptions[] = [] ) => {
    const iChannelsCode = channels.map( ( channel: iChannelOptions ) => {
    return `layout(binding = ${channel.samplerBinding}) uniform sampler ${channel.name}_sampler;
layout(binding = ${channel.textureBinding}) uniform texture2D ${channel.name}_tex;
`;
}).join('\n');

return `#version 450
precision highp float;
precision highp int;
precision highp sampler;

layout(binding = 0, std140) uniform u {
    vec3 iResolution;
    float iTime;
    vec4 iMouse;
    int iFrame;
    vec3[] iChannelResolution;
};

${iChannelsCode}

layout(location = 0) out vec4 shadertoy_out_color;

void mainImage( out vec4 c, in vec2 f );
void st_assert( bool cond );
void st_assert( bool cond, int v );
void st_assert( bool cond, int v ) {
    if(!cond) {
        if(v == 0)shadertoy_out_color.x = -1.0;
        else if(v == 1)shadertoy_out_color.y = -1.0;
        else if(v == 2)shadertoy_out_color.z = -1.0;
        else shadertoy_out_color.w = -1.0;
    }

}
void st_assert( bool cond ) {
    if (!cond) shadertoy_out_color.x = -1.0;
}
`
}


export const fxCode =
`void main( void ) {
    shadertoy_out_color = vec4(1.0, 1.0, 1.0, 1.0);
    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
    mainImage( color, vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y) );
    if(shadertoy_out_color.x<0.0) color = vec4(1.0, 0.0, 0.0, 1.0);
    if(shadertoy_out_color.y<0.0) color = vec4(0.0, 1.0, 0.0, 1.0);
    if(shadertoy_out_color.z<0.0) color = vec4(0.0, 0.0, 1.0, 1.0);
    if(shadertoy_out_color.w<0.0) color = vec4(1.0, 1.0, 0.0, 1.0);
    shadertoy_out_color = vec4(color.xyz, 1.0);
}`