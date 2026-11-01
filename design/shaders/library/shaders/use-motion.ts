import { useLayoutEffect, useRef } from "react";
import type { Clock } from "../use-clock";
import type { ShaderValues } from "./definitions";
import { type Motion, motions, retime } from "./motion";

export const useMotion = (
  id: string,
  shader: string,
  values: ShaderValues,
  box: { width: number; height: number },
  clock: Clock,
) => {
  const style = useRef<HTMLStyleElement>(null);
  const previous = useRef<Motion[]>([]);
  const revision = useRef(0);
  const encoded = JSON.stringify(values);
  useLayoutEffect(() => {
    if (!box.width || !box.height || !style.current) return;
    const values = JSON.parse(encoded) as ShaderValues;
    const time = clock.external ? 0 : clock.time();
    const next = motions(shader, values, box, time).map((item) => {
      const old = previous.current.find((motion) => motion.name === item.name);
      return old && !clock.external ? retime(old, item, time) : item;
    });
    previous.current = next;
    revision.current += 1;
    const motionName = (item: Motion) =>
      `${id}-${item.name}-${revision.current}${item.durationSeconds ? "" : "-stationary"}`;
    // New animation names restart the CSS timelines at their preserved negative delays.
    const animation = (item: Motion) => {
      const name = motionName(item);
      return `${name} ${item.durationSeconds || 1}s ${item.timing} ${item.delaySeconds}s infinite ${item.direction} both`;
    };
    const keyframes = next
      .map((item) => {
        const name = motionName(item);
        const { x, y } = item.distance;
        // Independent properties let inverse mask motion share a content layer with pattern motion.
        if (item.name.endsWith("-counter"))
          return `@keyframes ${name} { from { translate: 0px 0px; } to { translate: ${x}px ${y}px; } }`;
        return `@keyframes ${name} { from { transform: translate(0, 0); } to { transform: translate(${x}px, ${y}px); } }`;
      })
      .join("\n");
    const layers = Array.from(style.current.parentElement!.querySelectorAll<HTMLElement>("[data-motion]"))
      .map((element) => {
        const names = element.dataset.motion!.split(" ");
        const parts = next.filter((item) => names.includes(item.name));
        if (!parts.length) return "";
        const playback = parts.map((item) => (item.durationSeconds ? "var(--shader-play-state)" : "paused"));
        return `#${id} [data-motion="${element.dataset.motion}"] { animation: ${parts.map(animation).join(", ")}; animation-play-state: ${playback.join(", ")}; }`;
      })
      .join("\n");
    style.current.textContent = `${keyframes}\n${layers}`;
    if (clock.external) clock.seek(clock.time());
  }, [id, shader, encoded, box, clock]);
  return style;
};
