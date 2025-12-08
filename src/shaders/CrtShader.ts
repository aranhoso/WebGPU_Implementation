export const CrtShaderCode = `
@group(0) @binding(0) var sceneTex : texture_2d<f32>;
@group(0) @binding(1) var sceneSampler : sampler;
@group(0) @binding(2) var<uniform> params : PostParams;

struct PostParams {
    // resTimeStrength: x = width, y = height, z = timeSeconds, w = fisheye_strength
    resTimeStrength : vec4<f32>,
    // misc1: x = scan_line_intensity, y = rgb_offset, z = vignette_intensity, w = wave_amplitude
    misc1 : vec4<f32>,
    // misc2: x = wave_frequency, y = jitter_intensity
    misc2 : vec4<f32>,
}

struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) uv : vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );

    var uvs = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 0.0),
        vec2<f32>(2.0, 0.0),
        vec2<f32>(0.0, 2.0)
    );

    var output : VertexOutput;
    output.Position = vec4<f32>(positions[VertexIndex], 0.0, 1.0);
    output.uv = uvs[VertexIndex];
    return output;
}

fn random(st : vec2<f32>) -> f32 {
    return fract(sin(dot(st, vec2<f32>(12.9898, 78.233))) * 43758.5453123);
}

fn fisheye(uv : vec2<f32>, strength : f32) -> vec2<f32> {
    let d = uv - vec2<f32>(0.5, 0.5);
    let r = length(d);
    if (r < 1e-5) {
        return uv;
    }
    let rf = pow(r, strength) / pow(0.5, strength - 1.0);
    return vec2<f32>(0.5, 0.5) + rf * normalize(d);
}

fn curve(uv : vec2<f32>) -> vec2<f32> {
    var v = (uv - vec2<f32>(0.5, 0.5)) * 2.0;
    v = v * 1.05;
    v.x = v.x * (1.0 + pow((abs(v.y) / 6.0), 2.0));
    v.y = v.y * (1.0 + pow((abs(v.x) / 5.0), 2.0));
    v = (v / 2.0) + vec2<f32>(0.5, 0.5);
    v = v * 0.95 + vec2<f32>(0.025, 0.025);
    return v;
}

fn apply_wave(uv : vec2<f32>, time : f32, amp : f32, freq : f32) -> vec2<f32> {
    var wave = uv;
    wave.x = wave.x + amp * sin(freq * uv.y + time * 2.0);
    wave.y = wave.y + amp * 0.5 * sin(freq * uv.x + time * 1.5);
    return wave;
}

fn adjust_saturation(color : vec3<f32>, adjustment : f32) -> vec3<f32> {
    let weights = vec3<f32>(0.299, 0.587, 0.114);
    let lum = dot(color, weights);
    return mix(vec3<f32>(lum, lum, lum), color, adjustment);
}

@fragment
fn fs_main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
    let resolution = params.resTimeStrength.xy;
    let time = params.resTimeStrength.z;
    let fisheyeStrength = params.resTimeStrength.w;

    let scanLineIntensity = params.misc1.x;
    let rgbOffset = params.misc1.y;
    let vignetteIntensity = params.misc1.z;
    let waveAmplitude = params.misc1.w;

    let waveFrequency = params.misc2.x;
    let jitterIntensity = params.misc2.y;

    var q = uv;

    // jitter
    let jitterX = random(vec2<f32>(time * 10.0, 0.0)) * 2.0 - 1.0;
    let jitterY = random(vec2<f32>(0.0, time * 10.0)) * 2.0 - 1.0;
    q = q + vec2<f32>(jitterX, jitterY) * jitterIntensity;

    // fisheye then curve
    q = fisheye(q, fisheyeStrength);
    var uvWarped = curve(q);

    // wave motion
    uvWarped = apply_wave(uvWarped, time, waveAmplitude, waveFrequency);

    // barrel-ish warp already in curve; flip Y for render target origin
    uvWarped.y = 1.0 - uvWarped.y;

    // early discard if outside
    if (uvWarped.x < 0.0 || uvWarped.x > 1.0 || uvWarped.y < 0.0 || uvWarped.y > 1.0) {
        return vec4<f32>(0.0, 0.0, 0.0, 1.0);
    }

    // noise offset
    let noiseTime = time * 0.5;
    let x = sin(0.3 * noiseTime + uvWarped.y * 21.0) *
            sin(0.7 * noiseTime + uvWarped.y * 29.0) *
            sin(0.3 + 0.33 * noiseTime + uvWarped.y * 31.0) * 0.001;

    let timeOffset = sin(time * 0.5) * 0.0002;

    var col = vec3<f32>(0.0, 0.0, 0.0);
    col.x = textureSampleLevel(sceneTex, sceneSampler, vec2<f32>(x + uvWarped.x + rgbOffset + timeOffset, uvWarped.y + rgbOffset), 0.0).x;
    col.y = textureSampleLevel(sceneTex, sceneSampler, vec2<f32>(x + uvWarped.x, uvWarped.y), 0.0).y;
    col.z = textureSampleLevel(sceneTex, sceneSampler, vec2<f32>(x + uvWarped.x - rgbOffset - timeOffset, uvWarped.y - rgbOffset), 0.0).z;

    let bleedIntensity = 0.04 + sin(time) * 0.01;
    col.x = col.x + bleedIntensity * textureSampleLevel(sceneTex, sceneSampler, 0.75 * vec2<f32>(x + 0.025, -0.027) + vec2<f32>(uvWarped.x + rgbOffset, uvWarped.y + rgbOffset), 0.0).x;
    col.y = col.y + (bleedIntensity * 0.6) * textureSampleLevel(sceneTex, sceneSampler, 0.75 * vec2<f32>(x - 0.022, -0.02) + vec2<f32>(uvWarped.x, uvWarped.y), 0.0).y;
    col.z = col.z + bleedIntensity * textureSampleLevel(sceneTex, sceneSampler, 0.75 * vec2<f32>(x - 0.02, -0.018) + vec2<f32>(uvWarped.x - rgbOffset, uvWarped.y - rgbOffset), 0.0).z;

    // color correction
    col = clamp(col * 0.7 + 0.3 * col * col * 1.2, vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(1.0, 1.0, 1.0));

    // vignette
    let vig = (16.0 * uvWarped.x * uvWarped.y * (1.0 - uvWarped.x) * (1.0 - uvWarped.y));
    col = col * pow(vig, vignetteIntensity);

    // pulses
    let brightnessPulse = 1.0 + 0.02 * sin(time * 0.5);
    let saturationPulse = 1.0 + 0.15 * sin(time * 0.5 + 0.5);
    col = col * vec3<f32>(0.98, 1.02, 0.98) * brightnessPulse;
    col = adjust_saturation(col, saturationPulse);
    col = col * 1.5;

    // scan lines
    let scanFreq = 0.5;
    let scanSpeed = time * 1.5;
    let scans = clamp(0.5 + 0.5 * sin(scanSpeed + uvWarped.y * resolution.y * 1.5 * scanFreq), 0.0, 1.0);
    let s = pow(scans, 1.3);
    col = col * (1.0 - (scanLineIntensity * (1.0 - s)));

    // phosphor pulse
    col = col * (1.0 + 0.005 * sin(110.0 * time));

    // border fade
    let borderUv = abs(uvWarped - vec2<f32>(0.5, 0.5)) * 2.0;
    let borderFade = 1.0 - smoothstep(0.95, 1.0, max(borderUv.x, borderUv.y));
    col = col * borderFade;

    // pixel mask
    let pixelMask = 1.0 - 0.25 * clamp((abs((uvWarped.x * resolution.x + sin(time) * 2.0) % 2.0 - 1.0) * 2.0), 0.0, 1.0);
    col = col * pixelMask;

    col = clamp(col, vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(1.0, 1.0, 1.0));

    return vec4<f32>(col, 1.0);
}
`;
