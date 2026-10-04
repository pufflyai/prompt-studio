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
  useLayoutEffect(() => {
    if (!box.width || !box.height || !style.current) return;
    const time = clock.time();
    const next = motions(shader, values, box, time).map((item) => {
      const old = previous.current.find((motion) => motion.name === item.name);
      return old ? retime(old, item, time) : item;
    });
    previous.current = next;
    revision.current += 1;
    // New animation names restart the CSS timelines at their preserved negative delays.
    style.current.textContent = next
      .map((item) => {
        const name = `${id}-${item.name}-${revision.current}`;
        const { x, y } = item.distance;
        return `@keyframes ${name} { from { transform: translate(0, 0); } to { transform: translate(${x}px, ${y}px); } }
        #${id} [data-motion="${item.name}"] { animation: ${name} ${item.durationSeconds || 1}s ${item.timing} ${item.delaySeconds}s infinite ${item.direction} both; animation-play-state: ${item.durationSeconds ? "var(--shader-play-state)" : "paused"}; }`;
      })
      .join("\n");
  }, [id, shader, values, box, clock]);
  return style;
};
