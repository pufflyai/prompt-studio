import { Box } from "@chakra-ui/react";
import { useId } from "react";
import type { SceneProps } from "./model";

// Procedural SVG fields model shader-like treatments without a GPU or wall-clock loop.
// Only the active footer is painted, keeping message text on its normal surface.
export const WorkingTreatment = (props: SceneProps) => {
  const { time, reducedMotion, variant } = props;
  const id = useId().replaceAll(":", "");
  const phase = reducedMotion ? 0 : (time * Math.PI) / 3;
  if (variant.loader === "spinner" || variant.loader === "pulse") return null;
  return (
    <Box
      position="absolute"
      inset="0"
      overflow="hidden"
      pointerEvents="none"
      color={variant.loader === "aurora" ? "fg.info" : "fg.muted"}
      aria-hidden
    >
      <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 800 96" preserveAspectRatio="none">
        <defs>
          <radialGradient id={`${id}-glow`}>
            <stop stopColor="currentColor" stopOpacity="0.38" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-line`}>
            <stop stopColor="currentColor" stopOpacity="0" />
            <stop offset="0.5" stopColor="currentColor" stopOpacity="0.8" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {variant.loader === "scan" && (
          <rect
            x={reducedMotion ? 280 : 280 + Math.sin(phase) * 280}
            y="94"
            width="240"
            height="2"
            fill={`url(#${id}-line)`}
          />
        )}
        {variant.loader === "aurora" &&
          [0, 1, 2].map((layer) => (
            <ellipse
              key={layer}
              cx={160 + layer * 240 + Math.sin(phase + layer * 2) * 100}
              cy={85 + Math.cos(phase * 0.7 + layer) * 16}
              rx="300"
              ry="95"
              fill={`url(#${id}-glow)`}
            />
          ))}
        {variant.loader === "contours" &&
          Array.from({ length: 9 }, (_, row) => (
            <path
              key={row}
              d={`M -40 ${50 + row * 7} C 180 ${15 + row * 6 + Math.sin(phase) * 25}, 450 ${110 + row * 5 + Math.cos(phase) * 25}, 840 ${30 + row * 7}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              opacity={0.06 + row * 0.018}
            />
          ))}
      </svg>
    </Box>
  );
};
