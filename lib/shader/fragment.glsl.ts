export interface iChannelOptions {

    name: string,
    type: string,

}

export const fxCodeHeader = ( channels: iChannelOptions[] = [] ) => {

console.log(channels)

const iChannelsCode = channels.map( ( channel: iChannelOptions, i: number ) => {
    return `layout(binding = ${i * 2 + 1}) uniform sampler ${channel.name}_sampler;
layout(binding = ${i * 2 + 2}) uniform texture2D ${channel.name}_tex;
`;
}).join('\n');

return `#version 450
precision lowp float;

layout(binding = 0) uniform u {
    vec3 iResolution;
    float iTime;
    vec4 iMouse;
};

${iChannelsCode}

layout(location = 0) out vec4 outColor;
`
}



export const fxCodeMain = ( channels: iChannelOptions[] = [] ) => {

// const iChannelsCode = channels.map( ( channel: iChannelOptions ) => {
//     return `sampler2D ${channel.name} = sampler2D(${channel.name}_tex, ${channel.name}_sampler);`;
// }).join('\n');
    

return `void main(){
    vec4 shaderToyColor;
    vec2 fragCoord = vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y);
    mainImage(shaderToyColor, fragCoord);
    outColor = shaderToyColor;
}
`
}