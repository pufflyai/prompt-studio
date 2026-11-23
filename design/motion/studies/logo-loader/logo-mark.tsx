import {
  CENTER,
  EXIT_SECONDS,
  type Frame,
  HOME,
  INNER,
  LOOP,
  OUTER,
  type Outcome,
  type Point,
  ringMotion,
} from "./physics";

// Geometry from packages/pstdio-dashboard/public/logo.svg (26 × 26 units): a rounded square
// with a ring cut out of it. The ring is the moving part; physics.ts simulates it.
const SQUARE = "M8 0H18A8 8 0 0 1 26 8V18A8 8 0 0 1 18 26H8A8 8 0 0 1 0 18V8A8 8 0 0 1 8 0Z";

export interface LoaderSettings {
  outcome: Outcome;
  // Seconds of loading before the outcome arrives. Ignored for "loop".
  resultAt: number;
  drum: string;
  bounce: string;
  reducedMotion: boolean;
  // Exit speed: 1 is real time, larger is slower, 0 jumps to the final pose.
  tempo: number;
}

// The mark at `time` seconds since loading started. Exits end on their final pose and hold it.
export const frameAt = (time: number, settings: LoaderSettings): Frame => {
  const { outcome, resultAt, drum, bounce, reducedMotion, tempo } = settings;
  const resolved = outcome !== "loop" && time >= resultAt;
  const exit = resolved ? Math.min(EXIT_SECONDS, tempo === 0 ? EXIT_SECONDS : (time - resultAt) / tempo) : 0;
  if (reducedMotion) {
    const pulse = 0.7 + 0.3 * Math.cos((2 * Math.PI * Math.min(time, resultAt)) / LOOP);
    return {
      angle: 0,
      ring: HOME,
      ringScale: { x: 1, y: 1 },
      shift: { x: 0, y: 0 },
      scale: 1,
      opacity: resolved ? Math.min(1, pulse + exit / 0.3) : pulse,
    };
  }
  // Tempo slows only the exit; the loop always runs in real time so its physics stays true.
  return ringMotion(outcome, drum, bounce, resultAt)(resolved ? resultAt + exit : time);
};

const ellipse = (c: Point, rx: number, ry: number) =>
  `M${c.x - rx} ${c.y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;

export const LogoMark = (props: { frame: Frame; size: number }) => {
  const { frame, size } = props;
  const { ring, ringScale } = frame;
  const d =
    SQUARE +
    ellipse(ring, OUTER * ringScale.x, OUTER * ringScale.y) +
    ellipse(ring, INNER * ringScale.x, INNER * ringScale.y);
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" overflow="visible" aria-hidden="true">
      <g
        opacity={frame.opacity}
        transform={`translate(${frame.shift.x} ${frame.shift.y}) translate(${CENTER} ${CENTER}) scale(${frame.scale}) translate(${-CENTER} ${-CENTER})`}
      >
        <path
          d={d}
          fill="var(--chakra-colors-fg)"
          fillRule="evenodd"
          transform={`rotate(${frame.angle} ${CENTER} ${CENTER})`}
        />
      </g>
    </svg>
  );
};
