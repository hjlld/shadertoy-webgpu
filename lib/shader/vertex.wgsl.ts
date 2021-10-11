export default
`[[stage(vertex)]]
fn main (
    [[location(0)]] aVertexPosition : vec3<f32>
  ) -> [[builtin(position)]] vec4<f32> {
    return vec4<f32>(aVertexPosition, 1.0);
}`;