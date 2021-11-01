export default
`[[stage(vertex)]]
fn main (
    [[builtin(vertex_index)]] i: u32
  ) -> [[builtin(position)]] vec4<f32> {
    var vtx = array<vec3<f32>, 6>(
      vec3<f32>(-1.0,  1.0, 0.0),
      vec3<f32>(-1.0, -1.0, 0.0),
      vec3<f32>( 1.0, -1.0, 0.0),
      vec3<f32>( 1.0,  1.0, 0.0),
      vec3<f32>(-1.0,  1.0, 0.0),
      vec3<f32>( 1.0, -1.0, 0.0),
    );
    return vec4<f32>(vtx[i], 1.0);
}`;