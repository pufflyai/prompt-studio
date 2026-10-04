import type { ComponentType } from "react";
import type { ShaderValues } from "./definitions";

export interface PatternProps {
  id: string;
  values: ShaderValues;
  time: number;
  width: number;
  height: number;
  radius: number;
}

// Half-pixel positions keep 1px strokes on whole device pixels.
const crisp = (value: number) => Math.round(value) + 0.5;

const SectionHatch = (props: PatternProps) => {
  const { id, values, time } = props;
  const { spacing, angle, lineWidth, lineDrift } = values;
  return (
    <>
      <defs>
        <pattern
          data-motion="hatch"
          id={`${id}-hatch`}
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${angle}) translate(${(time * lineDrift) % spacing} 0)`}
        >
          <path d={`M ${lineWidth / 2} 0 V ${spacing}`} stroke="currentColor" strokeWidth={lineWidth} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-hatch)`} />
    </>
  );
};

// The band enters fully off the left edge and leaves fully off the right edge.
const DotsToGrid = (props: PatternProps) => {
  const { id, values, time } = props;
  const { spacing, dotSize, lineStrength, bandWidth, cycle } = values;
  const front = ((time % cycle) / cycle) * (1 + bandWidth);
  return (
    <>
      <defs>
        <pattern id={`${id}-dots`} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <rect width={dotSize} height={dotSize} fill="currentColor" />
        </pattern>
        <pattern id={`${id}-lines`} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <path d={`M 0 0.5 H ${spacing} M 0.5 0 V ${spacing}`} fill="none" stroke="currentColor" />
        </pattern>
        <linearGradient data-motion="band" id={`${id}-band`} x1={front - bandWidth} x2={front} y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.85" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-band-mask`}>
          <rect width="100%" height="100%" fill={`url(#${id}-band)`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-dots)`} />
      <rect
        width="100%"
        height="100%"
        fill={`url(#${id}-lines)`}
        opacity={lineStrength}
        mask={`url(#${id}-band-mask)`}
      />
    </>
  );
};

const PlotterCrosshair = (props: PatternProps) => {
  const { id, values, time, width, height } = props;
  const { gridSpacing, gridStrength, speed, markerSize } = values;
  const x = crisp(width * (0.5 + 0.4 * Math.sin(time * speed * 0.7)));
  const y = crisp(height * (0.5 + 0.3 * Math.sin(time * speed * 1.1 + 1)));
  return (
    <>
      <defs>
        <pattern id={`${id}-grid`} width={gridSpacing} height={gridSpacing} patternUnits="userSpaceOnUse">
          <path d={`M 0 0.5 H ${gridSpacing} M 0.5 0 V ${gridSpacing}`} fill="none" stroke="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-grid)`} opacity={gridStrength} />
      <path
        data-motion="crosshair"
        d={`M 0 ${y} H ${width} M ${x} 0 V ${height}`}
        fill="none"
        stroke="currentColor"
        strokeDasharray="2 3"
      />
      <rect
        data-motion="marker"
        x={x - markerSize / 2}
        y={y - markerSize / 2}
        width={markerSize}
        height={markerSize}
        fill="none"
        stroke="currentColor"
      />
    </>
  );
};

const RulerTicks = (props: PatternProps) => {
  const { values, time, width, height } = props;
  const { tickSpacing, majorEvery, majorLength, minorLength, speed } = values;
  const period = tickSpacing * majorEvery;
  const offset = (time * speed) % period;
  const ticks = Array.from({ length: Math.ceil(width / tickSpacing) + majorEvery + 1 }, (_, index) => {
    const x = crisp(index * tickSpacing - offset);
    const size = index % majorEvery === 0 ? majorLength : minorLength;
    return `M ${x} 0 V ${size} M ${x} ${height} V ${height - size}`;
  });
  return <path data-motion="ticks" d={ticks.join(" ")} fill="none" stroke="currentColor" />;
};

const DashedOutline = (props: PatternProps) => {
  const { values, time, width, height, radius } = props;
  const { dash, gap, inset, speed } = values;
  return (
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
      strokeDashoffset={-time * speed}
    />
  );
};

export const patterns: Record<string, ComponentType<PatternProps>> = {
  "section-hatch": SectionHatch,
  "dots-to-grid": DotsToGrid,
  "plotter-crosshair": PlotterCrosshair,
  "ruler-ticks": RulerTicks,
  "dashed-outline": DashedOutline,
};
