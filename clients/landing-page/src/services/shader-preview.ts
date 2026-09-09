const VERTEX_SOURCE = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentSource = (source: string) => `
precision mediump float;
uniform float u_time;
uniform float u_scale;
uniform vec2 u_resolution;
#line 1
${source}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x = (uv.x - 0.5) * u_resolution.x / u_resolution.y + 0.5;
  gl_FragColor = vec4(shade(uv), 1.0);
}`;

const compileShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "The shader could not compile.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

export const createShaderPreview = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
  if (!gl) throw new Error("This browser cannot display the shader preview.");
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  let program: WebGLProgram | null = null;
  let uniforms: {
    time: WebGLUniformLocation | null;
    scale: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
  } | null = null;

  const setSource = (source: string) => {
    let fragment: WebGLShader;
    try {
      fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource(source));
    } catch (error) {
      return (error as Error).message;
    }
    const next = gl.createProgram()!;
    gl.attachShader(next, vertex);
    gl.attachShader(next, fragment);
    gl.bindAttribLocation(next, 0, "a_position");
    gl.linkProgram(next);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(next, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(next) ?? "The shader could not link.";
      gl.deleteProgram(next);
      return message;
    }
    if (program) gl.deleteProgram(program);
    program = next;
    uniforms = {
      time: gl.getUniformLocation(program, "u_time"),
      scale: gl.getUniformLocation(program, "u_scale"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
    };
    return null;
  };

  return {
    setSource,
    resize: () => {
      const ratio = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    render: (time: number, scale: number) => {
      gl.useProgram(program);
      if (!uniforms) return;
      gl.uniform1f(uniforms.time, time);
      gl.uniform1f(uniforms.scale, scale);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose: () => {
      gl.useProgram(null);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteShader(vertex);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
};
