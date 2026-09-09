export const DEFAULT_SHADER_SCALE = 18;
export const DEFAULT_SHADER_SPEED = 0.6;

export const DEFAULT_SHADER_SOURCE = `vec3 shade(vec2 uv) {
  float rings = length(uv - 0.5);
  float wave = sin(
    rings * u_scale - u_time
  );
  vec3 a = vec3(0.10, 0.20, 0.55);
  vec3 b = vec3(0.40, 0.90, 0.85);
  vec3 color = mix(a, b, wave * 0.5 + 0.5);
  float icon = texture2D(u_icon, uv).a;
  return mix(vec3(0.04, 0.06, 0.10), color, icon);
}`;
