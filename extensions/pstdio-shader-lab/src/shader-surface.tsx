import { Box } from "@chakra-ui/react";
import { useEffect, useId, useRef, useState } from "react";
import { animatePattern } from "./shaders/animate-pattern";
import type { ShaderValues } from "./shaders/definitions";
import { NoiseMask } from "./shaders/noise-mask";
import { patterns } from "./shaders/patterns";
import type { Clock } from "./use-clock";

interface ShaderSurfaceProps {
  shader: string;
  values: ShaderValues;
  clock: Clock;
  theme: "light" | "dark";
}

// Fills its positioned parent inside the border and paints behind the parent's content.
// The parent sets `isolation="isolate"` so the negative z-index stays above its background.
// Inheriting the outer radius on the inner box keeps the lines inside the border's curve.
export const ShaderSurface = (props: ShaderSurfaceProps) => {
  const { shader, values, clock, theme } = props;
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replaceAll(":", "");
  const [box, setBox] = useState({ width: 0, height: 0, radius: 0 });
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
    const element = ref.current;
    if (!element) return;
    const update = () => animatePattern(element, shader, values, clock.time(), box);
    update();
    return clock.subscribe(update);
  }, [clock, shader, values, box]);
  const Pattern = patterns[shader];
  return (
    <Box
      ref={ref}
      position="absolute"
      inset="0"
      zIndex="-1"
      borderRadius="inherit"
      overflow="hidden"
      pointerEvents="none"
      color="fg.muted"
      aria-hidden
    >
      {Pattern && box.width > 0 && box.height > 0 && (
        <svg aria-hidden="true" width={box.width} height={box.height}>
          <NoiseMask id={id} values={values} {...box} />
          <g mask={`url(#${id}-noise)`} opacity={theme === "dark" ? values.darkOpacity : values.lightOpacity}>
            <Pattern id={id} values={values} time={0} {...box} />
          </g>
        </svg>
      )}
    </Box>
  );
};
