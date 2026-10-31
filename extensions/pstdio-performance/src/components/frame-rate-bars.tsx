import "./performance-bars.css";
import { performanceColor } from "./performance-color";

// 50 fps or more stays quiet; slower seconds take the warning or error color.
export const frameRateColor = (fps: number | undefined) => {
  if (fps === undefined) return "fg.subtle";
  if (fps >= 50) return "fg.muted";
  if (fps >= 30) return "fg.warning";
  return "fg.error";
};

const barColor = (fps: number | undefined) => {
  if (fps === undefined) return "border";
  if (fps >= 50) return "fg.subtle";
  return frameRateColor(fps);
};

interface FrameRateBarsProps {
  buckets: number[];
  count: number;
  height: string;
  width: string;
  gap: string;
}

// One bar per second, newest on the right. Missing seconds draw as a flat line.
export const FrameRateBars = (props: FrameRateBarsProps) => {
  const { buckets, count, height, width, gap } = props;
  const recent = buckets.slice(-count);
  const bars = [...Array<number | undefined>(count - recent.length).fill(undefined), ...recent];
  return (
    <span
      className="performance-bars"
      style={{ height: `var(--chakra-sizes-${height})`, gap: `var(--chakra-spacing-${gap})` }}
      aria-hidden
    >
      {bars.map((fps, index) => (
        <span
          // Bars are positional; a second has no identity of its own.
          key={index}
          className="performance-bar"
          style={{
            width: width === "auto" ? "auto" : `var(--chakra-sizes-${width})`,
            flex: width === "auto" ? "1" : undefined,
            height: `${Math.max(8, (Math.min(fps ?? 0, 60) / 60) * 100)}%`,
            backgroundColor: performanceColor(barColor(fps)),
          }}
        />
      ))}
    </span>
  );
};
