import type { ComponentType } from "react";
import type { ShaderValues } from "./definitions";

export interface PatternProps {
  id: string;
  values: ShaderValues;
  width: number;
  height: number;
  radius: number;
}

const crisp = (value: number) => Math.round(value) + 0.5;

const SectionHatch = (props: PatternProps) => {
  const { id, values, width, height } = props;
  const { spacing, angle, lineWidth } = values;
  return (
    <svg aria-hidden="true" width={width + spacing * 2} height={height + spacing * 2}>
      <defs>
        <pattern
          id={`${id}-hatch`}
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${angle})`}
        >
          <path d={`M ${lineWidth / 2} 0 V ${spacing}`} stroke="currentColor" strokeWidth={lineWidth} />
        </pattern>
      </defs>
      <rect
        x={-spacing}
        y={-spacing}
        width={width + spacing * 2}
        height={height + spacing * 2}
        fill={`url(#${id}-hatch)`}
      />
    </svg>
  );
};

const DotsToGrid = (props: PatternProps) => {
  const { id, values, width, height } = props;
  const { spacing, dotSize, lineStrength } = values;
  return (
    <>
      <svg aria-hidden="true" width={width} height={height}>
        <defs>
          <pattern id={`${id}-dots`} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
            <rect width={dotSize} height={dotSize} fill="currentColor" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill={`url(#${id}-dots)`} />
      </svg>
      <div data-motion="band">
        <div data-motion="band-counter">
          <svg aria-hidden="true" width={width} height={height} opacity={lineStrength}>
            <defs>
              <pattern id={`${id}-lines`} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
                <path d={`M 0 0.5 H ${spacing} M 0.5 0 V ${spacing}`} fill="none" stroke="currentColor" />
              </pattern>
            </defs>
            <rect width={width} height={height} fill={`url(#${id}-lines)`} />
          </svg>
        </div>
      </div>
    </>
  );
};

const PlotterCrosshair = (props: PatternProps) => {
  const { id, values, width, height } = props;
  const { gridSpacing, gridStrength, markerSize } = values;
  const x = crisp(width * 0.1);
  const y = crisp(height * 0.2);
  return (
    <>
      <svg aria-hidden="true" width={width} height={height}>
        <defs>
          <pattern id={`${id}-grid`} width={gridSpacing} height={gridSpacing} patternUnits="userSpaceOnUse">
            <path d={`M 0 0.5 H ${gridSpacing} M 0.5 0 V ${gridSpacing}`} fill="none" stroke="currentColor" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill={`url(#${id}-grid)`} opacity={gridStrength} />
      </svg>
      <div data-motion="crosshair-x">
        <svg aria-hidden="true" width={width} height={height}>
          <path d={`M ${x} 0 V ${height}`} fill="none" stroke="currentColor" strokeDasharray="2 3" />
        </svg>
        <div data-motion="crosshair-y">
          <svg aria-hidden="true" width={width} height={height}>
            <rect
              x={x - markerSize / 2}
              y={y - markerSize / 2}
              width={markerSize}
              height={markerSize}
              fill="none"
              stroke="currentColor"
            />
          </svg>
        </div>
      </div>
      <div data-motion="crosshair-y">
        <svg aria-hidden="true" width={width} height={height}>
          <path d={`M 0 ${y} H ${width}`} fill="none" stroke="currentColor" strokeDasharray="2 3" />
        </svg>
      </div>
    </>
  );
};

const RulerTicks = (props: PatternProps) => {
  const { values, width, height } = props;
  const { tickSpacing, majorEvery, majorLength, minorLength } = values;
  const period = tickSpacing * majorEvery;
  const ticks = Array.from({ length: Math.ceil(width / tickSpacing) + majorEvery + 1 }, (_, index) => {
    const x = crisp(index * tickSpacing);
    const size = index % majorEvery === 0 ? majorLength : minorLength;
    return `M ${x} 0 V ${size} M ${x} ${height} V ${height - size}`;
  });
  return (
    <svg aria-hidden="true" width={width + period} height={height}>
      <path d={ticks.join(" ")} fill="none" stroke="currentColor" />
    </svg>
  );
};

const DashedOutline = (props: PatternProps) => {
  const { values, width, height, radius } = props;
  const { dash, gap, inset } = values;
  return (
    <svg aria-hidden="true" width={width} height={height}>
      <rect
        data-motion="outline"
        x={inset}
        y={inset}
        width={Math.max(0, width - inset * 2)}
        height={Math.max(0, height - inset * 2)}
        rx={Math.max(0, radius - inset)}
        fill="none"
        stroke="currentColor"
        strokeDasharray={`${dash} ${gap}`}
      />
    </svg>
  );
};

interface Pattern {
  component: ComponentType<PatternProps>;
  motion: string;
}

export const patterns: Record<string, Pattern> = {
  "section-hatch": { component: SectionHatch, motion: "noise-counter hatch" },
  "dots-to-grid": { component: DotsToGrid, motion: "noise-counter" },
  "plotter-crosshair": { component: PlotterCrosshair, motion: "noise-counter" },
  "ruler-ticks": { component: RulerTicks, motion: "noise-counter ticks" },
  "dashed-outline": { component: DashedOutline, motion: "noise-counter" },
};
