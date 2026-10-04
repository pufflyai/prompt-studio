import { Box } from "@chakra-ui/react";
import { useEffect, useId, useRef, useState } from "react";
import { animateOutline } from "./shaders/animate-pattern";
import type { ShaderValues } from "./shaders/definitions";
import { noiseTile } from "./shaders/motion";
import { useNoiseImage } from "./shaders/noise-mask";
import { patterns } from "./shaders/patterns";
import { useMotion } from "./shaders/use-motion";
import type { Clock } from "./use-clock";

interface ShaderSurfaceProps {
  shader: string;
  values: ShaderValues;
  clock: Clock;
  theme: "light" | "dark";
}

// Preview geometry is scoped CSS; screen colors and the clip box use theme tokens.
export const ShaderSurface = (props: ShaderSurfaceProps) => {
  const { shader, values, clock, theme } = props;
  const ref = useRef<HTMLDivElement>(null);
  const id = `shader-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [box, setBox] = useState({ width: 0, height: 0, radius: 0 });
  const image = useNoiseImage(values, box.width, box.height);
  const style = useMotion(id, shader, values, box, clock);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height, radius });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => {
      if (ref.current) ref.current.dataset.playing = String(clock.isPlaying());
    };
    update();
    return clock.subscribePlayback(update);
  }, [clock]);
  useEffect(() => {
    const element = ref.current;
    if (!element || !box.width || !box.height || shader !== "dashed-outline") return;
    const update = () => animateOutline(element, values.speed, clock.time());
    update();
    return clock.subscribe(update);
  }, [clock, shader, values, box]);
  const pattern = patterns[shader];
  const tile = noiseTile(box.width, values.noiseScale);
  const band = box.width * values.bandWidth;
  return (
    <Box
      ref={ref}
      id={id}
      data-shader-surface={shader}
      position="absolute"
      inset="0"
      zIndex="-1"
      borderRadius="inherit"
      overflow="hidden"
      pointerEvents="none"
      color="fg.muted"
      aria-hidden
    >
      <style>{`
        #${id} { --shader-play-state: paused; }
        #${id}[data-playing="true"] { --shader-play-state: running; }
        #${id} :where([data-motion]:not([data-motion="outline"])) { position: absolute; top: 0; left: 0; width: ${box.width}px; height: ${box.height}px; }
        #${id} svg { display: block; }
        #${id} [data-motion~="hatch"] svg { overflow: visible; }
        #${id} [data-motion="noise"] { width: ${box.width + tile}px; mask-image: url("${image}"); mask-repeat: repeat-x; opacity: ${theme === "dark" ? values.darkOpacity : values.lightOpacity}; }
        #${id} [data-motion="band"] { left: ${-band}px; width: ${band}px; mask-image: linear-gradient(to right, transparent, black 85%, transparent); mask-repeat: no-repeat; }
        #${id} [data-motion="band-counter"] { left: ${band}px; }
      `}</style>
      <style ref={style} />
      {pattern && box.width > 0 && box.height > 0 && (
        <div data-motion="noise">
          <div data-motion={pattern.motion}>
            <pattern.component id={id} values={values} {...box} />
          </div>
        </div>
      )}
    </Box>
  );
};
