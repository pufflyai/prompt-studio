precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Drift Speed
 * @range 0.0, 20.0
 * @default 2.5
 */
uniform float u_speed;

/**
 * @label Shimmer
 * @range 0.0, 1.0
 * @default 0.5
 */
uniform float u_shimmer;

/**
 * @label Tint
 * @color
 * @default #8B9099
 */
uniform vec3 u_tint;

/**
 * @label Spacing
 * @range 8.0, 96.0
 * @default 26.0
 */
uniform float u_spacing;

/**
 * @label Dot Radius
 * @range 0.4, 4.0
 * @default 1.1
 */
uniform float u_dot;

/**
 * @label Intensity
 * @range 0.0, 1.0
 * @default 0.12
 */
uniform float u_intensity;

/**
 * @label Fade Height
 * @range 60.0, 2000.0
 * @default 460.0
 */
uniform float u_fade;

void main() {
  // the lattice drifts diagonally; the fade below stays fixed to the page
  vec2 uv = gl_FragCoord.xy + u_time * u_speed * vec2(0.6, -0.35);

  vec2 cell = mod(uv, u_spacing) - 0.5 * u_spacing;
  float d = length(cell);
  float dotMask = 1.0 - smoothstep(u_dot, u_dot + 1.2, d);

  // every 8th intersection reads as a faint registration mark
  vec2 idx = floor(uv / u_spacing);
  float majorX = 1.0 - step(0.5, mod(idx.x, 8.0));
  float majorY = 1.0 - step(0.5, mod(idx.y, 8.0));
  float boost = 1.0 + majorX * majorY * 0.8;

  // each dot breathes on its own phase
  float phase = dot(idx, vec2(0.37, 0.73)) * 6.2831;
  float tw = 0.5 + 0.5 * sin(u_time * 0.8 + phase);
  float shimmer = mix(1.0, 0.55 + 0.9 * tw, u_shimmer);

  // strongest under the header, dissolves down the page
  float yFromTop = u_resolution.y - gl_FragCoord.y;
  float fade = 1.0 - smoothstep(0.0, u_fade, yFromTop);

  float alpha = clamp(dotMask * boost * shimmer * fade * u_intensity, 0.0, 1.0);
  gl_FragColor = vec4(u_tint * alpha, alpha);
}
