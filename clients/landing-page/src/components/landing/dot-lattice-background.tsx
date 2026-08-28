import { Box } from "@chakra-ui/react";
import { useEffect, useRef } from "react";

// Mirrors design/dot-lattice.glsl with the uniform values from the
// "Website · Landing · Workbench" frame in the .pen design.
const FRAGMENT_SHADER = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_shimmer;
uniform vec3 u_tint;
uniform float u_spacing;
uniform float u_dot;
uniform float u_intensity;
uniform float u_fade;

void main() {
  vec2 uv = gl_FragCoord.xy + u_time * u_speed * vec2(0.6, -0.35);

  vec2 cell = mod(uv, u_spacing) - 0.5 * u_spacing;
  float d = length(cell);
  float dotMask = 1.0 - smoothstep(u_dot, u_dot + 1.2, d);

  vec2 idx = floor(uv / u_spacing);
  float majorX = 1.0 - step(0.5, mod(idx.x, 8.0));
  float majorY = 1.0 - step(0.5, mod(idx.y, 8.0));
  float boost = 1.0 + majorX * majorY * 0.8;

  float phase = dot(idx, vec2(0.37, 0.73)) * 6.2831;
  float tw = 0.5 + 0.5 * sin(u_time * 0.8 + phase);
  float shimmer = mix(1.0, 0.55 + 0.9 * tw, u_shimmer);

  float yFromTop = u_resolution.y - gl_FragCoord.y;
  float fade = 1.0 - smoothstep(0.0, u_fade, yFromTop);

  float alpha = clamp(dotMask * boost * shimmer * fade * u_intensity, 0.0, 1.0);
  gl_FragColor = vec4(u_tint * alpha, alpha);
}
`;

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const UNIFORMS = {
  u_speed: 3.8,
  u_shimmer: 0.76,
  u_spacing: 14.16,
  u_dot: 1,
  u_intensity: 0.13,
  u_fade: 1301.6,
};

const parseCssColor = (color: string) => {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return [0.5, 0.5, 0.5] as const;
  const [r, g, b] = match[1].split(",").map((part) => Number(part.trim()));
  return [r / 255, g / 255, b / 255] as const;
};

const compileShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

export const DotLatticeBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true });
    if (!gl) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram is not a React hook
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    for (const [name, value] of Object.entries(UNIFORMS)) {
      gl.uniform1f(gl.getUniformLocation(program, name), value);
    }

    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();

    const draw = () => {
      gl.uniform1f(timeLocation, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // the tint follows the fg.subtle token so the lattice adapts to the theme
    const applyTint = () => {
      const tint = parseCssColor(getComputedStyle(canvas).color);
      gl.uniform3f(gl.getUniformLocation(program, "u_tint"), tint[0], tint[1], tint[2]);
      draw();
    };

    const themeObserver = new MutationObserver(applyTint);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      draw();
    };

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    applyTint();
    resize();

    let frame = 0;
    const animate = () => {
      draw();
      frame = requestAnimationFrame(animate);
    };
    if (!reducedMotion) frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      themeObserver.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <Box
      ref={canvasRef}
      as="canvas"
      position="absolute"
      inset="0"
      width="100%"
      height="100%"
      color="fg.subtle"
      pointerEvents="none"
    />
  );
};
