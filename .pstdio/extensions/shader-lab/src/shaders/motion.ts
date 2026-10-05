import type { ShaderValues } from "./definitions";

export interface Motion {
  name: string;
  distance: { x: number; y: number };
  durationSeconds: number;
  delaySeconds: number;
  startedAtSeconds: number;
  timing: string;
  direction: "normal" | "alternate";
}

export const noiseTile = (width: number, scale: number) => Math.ceil(Math.max(width, scale * 4));

export const motions = (shader: string, values: ShaderValues, box: { width: number; height: number }, time: number) => {
  const result: Motion[] = [];
  const add = (
    name: string,
    x: number,
    y: number,
    durationSeconds: number,
    timing = "linear",
    phase = 0,
    alternate = false,
  ) => {
    result.push({
      name,
      distance: { x, y },
      durationSeconds,
      delaySeconds: -((durationSeconds ? time : 0) + phase * (durationSeconds || 1)),
      startedAtSeconds: time,
      timing,
      direction: alternate ? "alternate" : "normal",
    });
  };
  const tile = noiseTile(box.width, values.noiseScale);
  const noiseDuration = values.noiseDrift ? tile / values.noiseDrift : 0;
  const noiseSteps = `steps(${tile})`;
  add("noise", -tile, 0, noiseDuration, noiseSteps);
  add("noise-counter", tile, 0, noiseDuration, noiseSteps);
  if (shader === "section-hatch") {
    const angle = (values.angle * Math.PI) / 180;
    add(
      "hatch",
      values.spacing * Math.cos(angle),
      values.spacing * Math.sin(angle),
      values.lineDrift ? values.spacing / values.lineDrift : 0,
      `steps(${values.spacing})`,
    );
  } else if (shader === "ruler-ticks") {
    const period = values.tickSpacing * values.majorEvery;
    add("ticks", -period, 0, values.speed ? period / values.speed : 0, `steps(${period})`);
  } else if (shader === "dots-to-grid") {
    const distance = box.width * (1 + values.bandWidth);
    add("band", distance, 0, values.cycle);
    add("band-counter", -distance, 0, values.cycle);
  } else if (shader === "plotter-crosshair") {
    add("crosshair-x", box.width * 0.8, 0, values.speed ? Math.PI / (values.speed * 0.7) : 0, "ease-in-out", 0.5, true);
    add(
      "crosshair-y",
      0,
      box.height * 0.6,
      values.speed ? Math.PI / (values.speed * 1.1) : 0,
      "ease-in-out",
      0.5 + 1 / Math.PI,
      true,
    );
  }
  return result;
};

// Each layer owns its phase anchor. Retiming keeps a speed slider from restarting a loop.
export const retime = (previous: Motion, next: Motion, time: number) => {
  const elapsed = previous.durationSeconds ? time - previous.startedAtSeconds : 0;
  const phase = (elapsed - previous.delaySeconds) / (previous.durationSeconds || 1);
  const cycle = previous.direction === "alternate" ? 2 : 1;
  return { ...next, delaySeconds: -(phase % cycle) * (next.durationSeconds || 1), startedAtSeconds: time };
};
