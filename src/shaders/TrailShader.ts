export const TrailShaderCode = `
struct TrailUniforms {
    viewProj : mat4x4<f32>,
    camRight_size : vec4<f32>, // xyz = right, w = base size
    camUp_ttl : vec4<f32>,     // xyz = up,   w = ttl
    color : vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms : TrailUniforms;

struct VertexInput {
    @location(0) corner : vec2<f32>,      // per-vertex quad corner
    @location(1) center : vec3<f32>,      // per-instance position
    @location(2) age : f32,               // per-instance age seconds
}

struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) vAge : f32,
}

@vertex
fn vs_main(input : VertexInput) -> VertexOutput {
    var out : VertexOutput;

    // Fade size with age (simple linear falloff)
    let ttl = uniforms.camUp_ttl.w;
    let life = clamp(1.0 - (input.age / max(ttl, 0.0001)), 0.0, 1.0);
    let size = uniforms.camRight_size.w * life;

    let right = uniforms.camRight_size.xyz;
    let up = uniforms.camUp_ttl.xyz;

    let worldPos = input.center + (right * input.corner.x + up * input.corner.y) * size;
    out.Position = uniforms.viewProj * vec4<f32>(worldPos, 1.0);
    out.vAge = life;
    return out;
}

@fragment
fn fs_main(@location(0) vAge : f32) -> @location(0) vec4<f32> {
    let alpha = pow(vAge, 1.5);
    let color = uniforms.color * alpha;
    return color;
}
`;
