/**
 * Ambient pixel grid.
 *
 * A soft noise field quantized onto a chunky cell grid, in the spirit of the
 * Studio Dumbar / OpenAI DevDay identity. Single-tint and low-contrast, so it
 * can sit behind empty states without competing with foreground content.
 *
 * Outputs premultiplied alpha, so it composites over whatever fill sits beneath
 * it rather than baking in its own background color.
 */

/** @resolution */
uniform vec2 u_resolution;

/** @sdf */
uniform sampler2D u_sdf;

/**
 * @label Tint
 * @color
 * @default #FFF3C2
 */
uniform vec3 u_tint;

/**
 * @label Cell Size
 * @default 28
 * @range 8, 80
 */
uniform float u_cellSize;

/**
 * @label Field Scale
 * @default 2.2
 * @range 0.5, 8
 */
uniform float u_scale;

/**
 * @label Seed
 * @default 3
 * @range 0, 100
 */
uniform float u_seed;

/**
 * @label Intensity
 * @default 0.16
 * @range 0, 1
 */
uniform float u_intensity;

/**
 * @label Levels
 * @default 4
 * @range 1, 8
 */
uniform float u_levels;

/**
 * @label Edge Fade
 * @default 72
 * @range 0, 400
 */
uniform float u_fade;

/** @time */
uniform float u_time;

/**
 * @label Speed
 * @default 0.15
 * @range 0, 1
 */
uniform float u_speed;

/**
 * @label Motion — 0 drift, 1 bloom, 2 tide, 3 twinkle
 * @default 0
 * @range 0, 3
 */
uniform int u_motion;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), w.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), w.x),
    w.y
  );
}

// Normalized to ~0..1: octave amplitudes sum to 0.875.
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    v += amp * valueNoise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v / 0.875;
}

void main() {
  // Sample the field once per cell so everything lands on the grid.
  vec2 cell = floor(gl_FragCoord.xy / u_cellSize);
  vec2 cellCenter = (cell + 0.5) * u_cellSize;
  vec2 uv = cellCenter / max(u_resolution.y, 1.0);
  vec2 p = uv * u_scale + u_seed;

  // Motion never moves a plate's edges — the grid is fixed. It nudges the field
  // instead, so plates cross posterize thresholds and pop between levels.
  float t = u_time * u_speed;
  float bias = 0.0;

  if (u_motion == 1) {
    // Bloom: orbit the sample point, so the field churns in place with no
    // travel direction.
    p += vec2(sin(t), cos(t)) * 0.35;
  } else if (u_motion == 2) {
    // Tide: a wave sweeping diagonally, lighting cells up in bands.
    bias = sin(dot(uv, vec2(0.9, 0.6)) * 4.0 - t * 2.0) * 0.14;
  } else if (u_motion == 3) {
    // Twinkle: each cell keeps its own phase, so only a few flip at any moment.
    bias = sin(t + hash(cell) * 6.2831853) * 0.12;
  } else {
    // Drift: translate the field on a slow diagonal.
    p += vec2(t * 0.35, t * 0.12);
  }

  // Posterizing into discrete steps is what yields the flat plates of the
  // reference; a continuous ramp would just read as a blur.
  float density = smoothstep(0.30, 0.85, fbm(p) + bias);
  float levels = max(u_levels, 1.0);
  float coverage = floor(density * levels + 0.5) / levels;

  float dist = texture2D(u_sdf, gl_FragCoord.xy / u_resolution).r;
  float edge = smoothstep(0.0, max(u_fade, 0.001), dist);

  float alpha = coverage * u_intensity * edge;
  gl_FragColor = vec4(u_tint * alpha, alpha);
}
