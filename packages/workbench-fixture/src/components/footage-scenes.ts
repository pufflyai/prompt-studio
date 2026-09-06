import { type FootageEntry, formatTimecode } from "../data/footage-archive";

// All footage is drawn, not streamed: each scene kind is a deterministic function of
// elapsed clip time, so the archive stays a zero-asset demo of a custom canvas panel.
// Colors are burned-in "camera" content (like pixels of a video), not themed UI.

interface SceneContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  elapsed: number;
}

const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";

const drawWaveform = ({ ctx, width, height, elapsed }: SceneContext) => {
  ctx.fillStyle = "#03110d";
  ctx.fillRect(0, 0, width, height);

  const midY = height / 2;
  ctx.strokeStyle = "rgba(110, 255, 196, 0.08)";
  ctx.lineWidth = 1;
  for (let gridX = 0; gridX < width; gridX += 32) {
    ctx.beginPath();
    ctx.moveTo(gridX, 0);
    ctx.lineTo(gridX, height);
    ctx.stroke();
  }

  const trace = (amplitude: number, speed: number, detail: number, alpha: number) => {
    ctx.strokeStyle = `rgba(122, 255, 202, ${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(122, 255, 202, 0.6)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const phase = elapsed * speed + x * detail;
      const y =
        midY +
        Math.sin(phase) * amplitude * Math.sin(elapsed * 0.7 + x * 0.002) +
        Math.sin(phase * 2.7) * amplitude * 0.25;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  trace(height * 0.18, 2.4, 0.02, 0.85);
  trace(height * 0.08, 3.9, 0.045, 0.35);
};

const drawCorridor = ({ ctx, width, height, elapsed }: SceneContext) => {
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, width, height);

  const vanishX = width / 2;
  const vanishY = height * 0.46;
  ctx.strokeStyle = "rgba(180, 190, 200, 0.22)";
  ctx.lineWidth = 1;
  for (const [cornerX, cornerY] of [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cornerX, cornerY);
    ctx.lineTo(vanishX, vanishY);
    ctx.stroke();
  }

  // Ceiling lights recede toward the vanishing point; one of them flickers.
  for (let depth = 0; depth < 7; depth += 1) {
    const progress = (depth + ((elapsed * 0.35) % 1)) / 7;
    const y = vanishY + (height - vanishY) * 0.02 - progress * 4;
    const lightWidth = (1 - progress) * width * 0.3;
    const flicker = depth === 3 && Math.sin(elapsed * 23) > 0.4 ? 0.05 : 0.5;
    ctx.fillStyle = `rgba(210, 225, 235, ${flicker * (1 - progress)})`;
    ctx.fillRect(vanishX - lightWidth / 2, y - progress * height * 0.42, lightWidth, 2);
  }

  const vignette = ctx.createRadialGradient(vanishX, vanishY, height * 0.1, vanishX, vanishY, width * 0.7);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
};

const drawNoise = ({ ctx, width, height }: SceneContext) => {
  const cols = 160;
  const rows = Math.max(1, Math.round((cols * height) / Math.max(width, 1)));
  const cellW = width / cols;
  const cellH = height / rows;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const value = Math.random();
      if (value < 0.55) continue;
      const shade = Math.floor(40 + value * 130);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(col * cellW, row * cellH, cellW + 0.5, cellH + 0.5);
    }
  }
};

const drawBlackout = ({ ctx, width, height, elapsed }: SceneContext) => {
  ctx.fillStyle = "#050000";
  ctx.fillRect(0, 0, width, height);

  const pulse = Math.max(0, Math.sin(elapsed * 3.7));
  const glow = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.55);
  glow.addColorStop(0, `rgba(255, 40, 30, ${0.16 + pulse * 0.2})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = `rgba(255, 70, 60, ${0.55 + pulse * 0.45})`;
  ctx.font = `600 ${Math.max(12, height * 0.06)}px ${MONO_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("EMERGENCY POWER", width / 2, height / 2 + 4);
  ctx.textAlign = "left";
};

const sceneRenderers = {
  waveform: drawWaveform,
  corridor: drawCorridor,
  noise: drawNoise,
  blackout: drawBlackout,
};

const drawScanlines = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  for (let y = 0; y < height; y += 3) {
    ctx.fillRect(0, y, width, 1);
  }
};

const drawGlitch = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  for (let slice = 0; slice < 9; slice += 1) {
    const y = Math.random() * height;
    const sliceHeight = 2 + Math.random() * 10;
    const offset = (Math.random() - 0.5) * width * 0.2;
    const strip = ctx.getImageData(0, y, width, sliceHeight);
    ctx.putImageData(strip, offset, y);
  }
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.08})`;
  ctx.fillRect(0, 0, width, height);
};

const drawOverlay = (scene: SceneContext, entry: FootageEntry, playing: boolean, now: number) => {
  const { ctx, width, height, elapsed } = scene;
  const fontSize = Math.max(10, Math.round(height * 0.045));
  ctx.font = `500 ${fontSize}px ${MONO_FONT}`;
  ctx.fillStyle = "rgba(235, 240, 240, 0.88)";
  ctx.fillText(entry.camera, 12, fontSize + 10);

  ctx.textAlign = "right";
  ctx.fillText("BLUEBOOK · INTERNAL", width - 12, fontSize + 10);
  ctx.textAlign = "left";

  const footerY = height - 14;
  if (playing) {
    if (Math.floor(now / 600) % 2 === 0) {
      ctx.fillStyle = "rgba(255, 60, 50, 0.95)";
      ctx.beginPath();
      ctx.arc(18, footerY - fontSize * 0.32, fontSize * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(235, 240, 240, 0.88)";
    ctx.fillText(`REC ${formatTimecode(elapsed)}`, 32, footerY);
  } else {
    ctx.fillStyle = "rgba(235, 240, 240, 0.88)";
    ctx.fillText(`PAUSED ${formatTimecode(elapsed)}`, 12, footerY);
  }
};

export const drawFootageFrame = (
  ctx: CanvasRenderingContext2D,
  entry: FootageEntry,
  options: { width: number; height: number; elapsed: number; playing: boolean; glitching: boolean; now: number },
) => {
  const { width, height, elapsed, playing, glitching, now } = options;
  if (width === 0 || height === 0) return;
  const scene = { ctx, width, height, elapsed };
  sceneRenderers[entry.kind](scene);
  drawScanlines(ctx, width, height);
  if (glitching) drawGlitch(ctx, width, height);
  drawOverlay(scene, entry, playing, now);
};
