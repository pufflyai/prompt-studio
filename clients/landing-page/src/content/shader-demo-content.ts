export const DEFAULT_SHADER_SOURCE = `vec3 shade(vec2 uv) {
  vec2 p = (uv - 0.5) * u_scale * 0.35;
  float time = u_time * 0.4;
  p += 0.18 * sin(p.yx * 1.7 + vec2(time, -time));
  vec3 color = vec3(0.012, 0.018, 0.04);

  for (int i = 0; i < 6; i++) {
    float layer = float(i);
    float wave = sin(p.x * 1.6 + time + layer * 0.7) * 0.4;
    wave += sin(p.x * 2.8 - time * 0.8 + layer) * 0.16;
    float ribbon = p.y - wave + (layer - 2.5) * 0.24;
    float glow = 0.018 / (abs(ribbon) + 0.025);
    vec3 tint = 0.5 + 0.5 * cos(
      vec3(0.2, 2.1, 4.3) + layer * 0.75 + p.x * 0.45 + time * 0.3
    );
    color += tint * glow * 0.55;
  }
  return 1.0 - exp(-color * 1.4);
}`;

export const MATRIX_SHADER_SOURCE = `vec3 shade(vec2 uv) {
  vec2 cell = uv * u_scale;
  float column = floor(cell.x);
  float seed = fract(sin(column * 13.13) * 17.17);
  float row = floor(cell.y);
  float phase = mod(row + u_time * mix(1.2, 3.2, seed) + seed * 18.0, 18.0);
  float trail = exp(-phase * 0.32) * smoothstep(0.0, 0.8, phase);
  float headDistance = (phase - 1.0) * 1.5;
  float head = exp(-headDistance * headDistance);
  float icon = texture2D(u_icon, cell).a;

  vec3 green = vec3(0.04, 0.65, 0.28);
  vec3 mint = vec3(0.76, 1.0, 0.86);
  vec3 ink = mix(green, mint, head);
  return vec3(0.018, 0.04, 0.027)
    + ink * icon * (0.035 + trail);
}`;

export const AURORA_SHADER = { filename: "aurora.frag", source: DEFAULT_SHADER_SOURCE, scale: 8, speed: 0.6 };
export const MATRIX_SHADER = { filename: "icon-matrix.frag", source: MATRIX_SHADER_SOURCE, scale: 16, speed: 1.8 };
