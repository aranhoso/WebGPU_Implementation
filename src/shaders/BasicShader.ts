export const BasicShaderCode = `
struct Uniforms {
    modelViewProjectionMatrix : mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var mySampler : sampler;
@group(0) @binding(2) var myTexture : texture_2d<f32>;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) uv : vec2<f32>,
    @location(2) normal : vec3<f32>,
}

struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) UV : vec2<f32>,
    @location(1) Normal : vec3<f32>,
}

@vertex
fn vs_main(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.Position = uniforms.modelViewProjectionMatrix * vec4<f32>(input.position, 1.0);
    output.UV = input.uv;
    output.Normal = input.normal;
    return output;
}

@fragment
fn fs_main(@location(0) UV : vec2<f32>, @location(1) Normal : vec3<f32>) -> @location(0) vec4<f32> {
    return textureSample(myTexture, mySampler, UV);
}
`;