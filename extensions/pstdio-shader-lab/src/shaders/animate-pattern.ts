import type { ShaderValues } from "./definitions";

// Update only moving SVG attributes. React owns the static geometry and controls.
export const animatePattern = (
  root: HTMLElement,
  shader: string,
  values: ShaderValues,
  time: number,
  box: { width: number; height: number },
) => {
  const element = (name: string) => root.querySelector<SVGElement>(`[data-motion="${name}"]`);
  const noise = element("noise");
  const tile = Math.ceil(Math.max(box.width, values.noiseScale * 4));
  if (noise) noise.style.transform = `translateX(${-((time * values.noiseDrift) % tile)}px)`;
  if (shader === "section-hatch") {
    element("hatch")?.setAttribute(
      "patternTransform",
      `rotate(${values.angle}) translate(${(time * values.lineDrift) % values.spacing} 0)`,
    );
  } else if (shader === "dots-to-grid") {
    const front = ((time % values.cycle) / values.cycle) * (1 + values.bandWidth);
    element("band")?.setAttribute("x1", String(front - values.bandWidth));
    element("band")?.setAttribute("x2", String(front));
  } else if (shader === "plotter-crosshair") {
    const x = Math.round(box.width * (0.5 + 0.4 * Math.sin(time * values.speed * 0.7))) + 0.5;
    const y = Math.round(box.height * (0.5 + 0.3 * Math.sin(time * values.speed * 1.1 + 1))) + 0.5;
    element("crosshair")?.setAttribute("d", `M 0 ${y} H ${box.width} M ${x} 0 V ${box.height}`);
    element("marker")?.setAttribute("x", String(x - values.markerSize / 2));
    element("marker")?.setAttribute("y", String(y - values.markerSize / 2));
  } else if (shader === "ruler-ticks") {
    const offset = Math.round((time * values.speed) % (values.tickSpacing * values.majorEvery));
    const ticks = element("ticks");
    if (ticks) ticks.style.transform = `translateX(${-offset}px)`;
  } else if (shader === "dashed-outline") {
    element("outline")?.setAttribute("stroke-dashoffset", String(-time * values.speed));
  }
};
