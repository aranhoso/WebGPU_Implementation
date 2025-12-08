shader_type canvas_item;

uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_nearest;
uniform float fisheye_strength = 0.5;
uniform float scan_line_intensity = 0.175;
uniform float rgb_offset = 0.001;
uniform float vignette_intensity = 0.3;
uniform float wave_amplitude = 0.0002;
uniform float wave_frequency = 5.0;
uniform float jitter_intensity = 0.0003;

// Função para gerar ruído pseudo-aleatório
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

vec2 fisheye(vec2 uv) {
    vec2 d = uv - 0.5;
    float r = length(d);
    float theta = atan(d.y, d.x);
    float rf = pow(r, fisheye_strength) / pow(0.5, fisheye_strength - 1.0);
    return vec2(0.5) + rf * normalize(d);
}

vec2 curve(vec2 uv) {
    uv = (uv - 0.5) * 2.0;
    uv *= 1.05;
    uv.x *= 1.0 + pow((abs(uv.y) / 6.0), 2.0);
    uv.y *= 1.0 + pow((abs(uv.x) / 5.0), 2.0);
    uv = (uv / 2.0) + 0.5;
    uv = uv * 0.95 + 0.025;
    return uv;
}

// Função para adicionar movimento ondulante
vec2 apply_wave(vec2 uv, float time) {
    vec2 wave_uv = uv;
    // Movimento horizontal suave
    wave_uv.x += wave_amplitude * sin(wave_frequency * uv.y + time * 2.0);
    // Movimento vertical muito sutil
    wave_uv.y += wave_amplitude * 0.5 * sin(wave_frequency * uv.x + time * 1.5);
    return wave_uv;
}

// Função para ajustar saturação
vec3 adjust_saturation(vec3 color, float adjustment) {
    const vec3 weights = vec3(0.299, 0.587, 0.114);
    float luminance = dot(color, weights);
    return mix(vec3(luminance), color, adjustment);
}

void fragment() {
    vec2 iResolution = 1.0 / SCREEN_PIXEL_SIZE;
    vec2 q = FRAGCOORD.xy / iResolution.xy;
    
    // Adiciona um leve tremor aleatório
    float jitter_x = random(vec2(TIME * 10.0, 0.0)) * 2.0 - 1.0;
    float jitter_y = random(vec2(0.0, TIME * 10.0)) * 2.0 - 1.0;
    q += vec2(jitter_x, jitter_y) * jitter_intensity;
    
    // Apply fisheye distortion
    q = fisheye(q);
    
    vec2 uv = curve(q);
    
    // Aplica o efeito de onda
    uv = apply_wave(uv, TIME);
    
    vec3 col;
    
    // Ruído reduzido com movimento
    float noise_time = TIME * 0.5;
    float x = sin(0.3*noise_time+uv.y*21.0)*sin(0.7*noise_time+uv.y*29.0)*sin(0.3+0.33*noise_time+uv.y*31.0)*0.001;
    
    // Separação RGB com movimento
    float time_offset = sin(TIME * 0.5) * 0.0002;
    col.r = texture(screen_texture, vec2(x+uv.x+rgb_offset+time_offset, uv.y+rgb_offset)).x;
    col.g = texture(screen_texture, vec2(x+uv.x, uv.y)).y;
    col.b = texture(screen_texture, vec2(x+uv.x-rgb_offset-time_offset, uv.y-rgb_offset)).z;
    
    // Color bleeding com movimento
    float bleed_intensity = 0.04 + sin(TIME) * 0.01;
    col.r += bleed_intensity * texture(screen_texture, 0.75*vec2(x+0.025, -0.027)+vec2(uv.x+rgb_offset, uv.y+rgb_offset)).x;
    col.g += (bleed_intensity * 0.6) * texture(screen_texture, 0.75*vec2(x+-0.022, -0.02)+vec2(uv.x, uv.y)).y;
    col.b += bleed_intensity * texture(screen_texture, 0.75*vec2(x+-0.02, -0.018)+vec2(uv.x-rgb_offset, uv.y-rgb_offset)).z;
    
    // Correção de cor
    col = clamp(col*0.7+0.3*col*col*1.2, 0.0, 1.0);
    
    // Vignette
    float vig = (0.0 + 1.0*16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y));
    col *= vec3(pow(vig, vignette_intensity));
    
    // Pulsos sincronizados para brilho e saturação
    float brightness_pulse = 1.0 + 0.02 * sin(TIME * 0.5);
    float saturation_pulse = 1.0 + 0.15 * sin(TIME * 0.5 + 0.5);
    
    // Ajuste de cor com pulso duplo
    col *= vec3(0.98, 1.02, 0.98) * brightness_pulse;
    col = adjust_saturation(col, saturation_pulse);
    col *= 1.5;
    
    // Scan lines com movimento
    float scan_freq = 0.5;
    float scan_speed = TIME * 1.5;
    float scans = clamp(0.5+0.5*sin(scan_speed+uv.y*iResolution.y*1.5), 0.0, 1.0);
    float s = pow(scans, 1.3);
    col = col*vec3(1.0 - (scan_line_intensity * (1.0 - s)));
    
    // Brilho do fósforo com pulso
    col *= 1.0 + 0.005*sin(110.0*TIME);
    
    // Screen bounds check com borda suave
    float border = 0.03;
    vec2 border_uv = abs(uv - 0.5) * 2.0;
    float border_fade = 1.0 - smoothstep(0.95, 1.0, max(border_uv.x, border_uv.y));
    col *= border_fade;
    
    // Máscara de pixels com movimento
    float pixel_mask = 1.0-0.25*vec3(clamp((mod(FRAGCOORD.x + sin(TIME) * 2.0, 2.0)-1.0)*2.0, 0.0, 1.0)).x;
    col *= pixel_mask;
    
    COLOR = vec4(col, 1.0);
}