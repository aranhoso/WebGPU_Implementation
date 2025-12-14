export const PhongShaderCode = `
struct Uniforms {
  modelViewProjectionMatrix : mat4x4<f32>,
  lightDirShininess : vec4<f32>,
  lightColor : vec4<f32>,
  ambient : vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var sceneSampler : sampler;
@group(0) @binding(2) var diffuseTexture : texture_2d<f32>;

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
  output.Normal = normalize(input.normal);
  return output;
}

@fragment
fn fs_main(@location(0) UV : vec2<f32>, @location(1) Normal : vec3<f32>) -> @location(0) vec4<f32> {
  let texColor = textureSample(diffuseTexture, sceneSampler, UV);
  let albedo = texColor.rgb;
  let alpha = texColor.a;

  if (alpha < 0.1) {
    discard;
  }

  let n = normalize(Normal);
  let lightDir = normalize(uniforms.lightDirShininess.xyz);
  let viewDir = normalize(vec3<f32>(0.0, 0.0, 1.0));

  let ambient = uniforms.ambient.xyz;

  let diff = max(dot(n, lightDir), 0.0);
  let diffuse = diff * uniforms.lightColor.xyz;

  let reflectDir = reflect(-lightDir, n);
  let specAngle = max(dot(viewDir, reflectDir), 0.0);
  let shininess = max(uniforms.lightDirShininess.w, 1.0);
  let specular = pow(specAngle, shininess) * uniforms.lightColor.xyz;

  let lighting = min(ambient + diffuse + specular * 0.5, vec3<f32>(2.5, 2.5, 2.5));
  let color = albedo * lighting;

  return vec4<f32>(color, alpha);
}
`;