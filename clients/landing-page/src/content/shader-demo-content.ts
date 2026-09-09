export const DEFAULT_SHADER_SCALE = 8;
export const DEFAULT_SHADER_SPEED = 0.6;

export const DEFAULT_SHADER_SOURCE = `vec3 shade(vec2 uv) {
  vec2 cell = uv * u_scale;
  float column = floor(cell.x);
  float seed = fract(sin(column * 13.13) * 17.17);
  cell.y += u_time * mix(1.2, 3.2, seed);

  float row = floor(cell.y);
  float distance = mod(row + floor(seed * 23.0), 18.0);
  float trail = max(0.04, 1.0 - distance / 11.0);
  float head = 1.0 - step(1.0, distance);
  float icon = texture2D(u_icon, cell).a;

  vec3 green = vec3(0.04, 0.65, 0.28);
  vec3 mint = vec3(0.76, 1.0, 0.86);
  vec3 ink = mix(green, mint, head);
  float glow = exp(-length(fract(cell) - 0.5) * 8.0);
  return vec3(0.018, 0.04, 0.027)
    + ink * trail * (icon + glow * 0.08);
}`;
