/**
 * Contour echo.
 *
 * Concentric contour lines traced from the node's own outline and warped by
 * noise, like a topographic map of the empty space. They are densest at the
 * border and fall off toward the middle, so the centre stays clean for whatever
 * content the empty state holds.
 *
 * Leans on a property of signed distance fields: |grad(d)| == 1, so contours of
 * d / spacing come out at constant width with no derivative extension needed.
 * The noise warp perturbs that gradient, which is why Wobble stays modest by
 * default — push it far enough and the lines break up.
 *
 * Outputs premultiplied alpha, so it composites over whatever fill sits beneath.
 */

/** @resolution */
uniform vec2 u_resolution;

/** @sdf */
uniform sampler2D u_sdf;

/** @time */
uniform float u_time;

/**
 * @label Tint
 * @color
 * @default #5E6AD2
 */
uniform vec3 u_tint;

/**
 * @label Ring Spacing
 * @default 22
 * @range 6, 80
 */
uniform float u_spacing;

/**
 * @label Line Thickness
 * @default 0.1
 * @range 0.02, 0.5
 */
uniform float u_thickness;

/**
 * @label Wobble
 * @default 1.6
 * @range 0, 6
 */
uniform float u_wobble;

/**
 * @label Wobble Scale
 * @default 1.8
 * @range 0.2, 6
 */
uniform float u_scale;

/**
 * @label Falloff
 * @default 120
 * @range 20, 600
 */
uniform float u_falloff;

/**
 * @label Intensity
 * @default 0.5
 * @range 0, 1
 */
uniform float u_intensity;

/**
 * @label Speed
 * @default 0.12
 * @range 0, 1
 */
uniform float u_speed;

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
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // r holds the signed distance to the node's outline, in pixels, positive inside.
  float d = texture2D(u_sdf, uv).r;

  vec2 p = gl_FragCoord.xy / max(u_resolution.y, 1.0) * u_scale;
  float warp = fbm(p) - 0.5;

  // Subtracting time walks the contours inward from the border.
  float field = d / u_spacing + warp * u_wobble - u_time * u_speed;

  float ring = abs(fract(field) - 0.5) * 2.0;
  float line = smoothstep(u_thickness, 0.0, ring);

  // Densest at the outline, clearing out toward the middle.
  float falloff = exp(-max(d, 0.0) / u_falloff);

  float alpha = line * falloff * step(0.0, d) * u_intensity;
  gl_FragColor = vec4(u_tint * alpha, alpha);
}
