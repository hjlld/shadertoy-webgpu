export const fxCodeHeader =
`#version 450
precision lowp float;

layout(binding = 0) uniform u {
    vec3 iResolution;
    float iTime;
    vec4 iMouse;
};
layout(location = 0) out vec4 outColor;
`

export const fxCodeMain = 
`
void main(){
    vec4 shaderToyColor;
    vec2 fragCoord = vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y);
    mainImage(shaderToyColor, fragCoord);
    outColor = shaderToyColor;
}
`