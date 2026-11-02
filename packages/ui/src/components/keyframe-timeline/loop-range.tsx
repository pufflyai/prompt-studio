import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { moveLoopBoundary, timeLabel } from "./keyframe-model";
import type { KeyframeLoopRange } from "./keyframe-timeline.types";
import { TimelineLabel, TimelineLane, TimelineLoopBand, TimelineLoopHandle, TimelineRow } from "./timeline-parts";

interface LoopRangeProps {
  range: KeyframeLoopRange;
  duration: number;
  fps: number;
  onChange?: (range: KeyframeLoopRange) => void;
}
const Boundary = (props: LoopRangeProps & { boundary: "start" | "end" }) => {
  const { range, boundary, duration, fps, onChange } = props;
  const time = range[boundary];
  const start = boundary === "start";
  const drag = useRef<{ x: number; time: number; width: number } | null>(null);
  const change = (value: number) => onChange?.(moveLoopBoundary(range, boundary, value, duration, fps));
  return (
    <TimelineLoopHandle
      role="slider"
      tabIndex={onChange ? 0 : -1}
      aria-label={start ? "Loop start" : "Loop end"}
      aria-disabled={!onChange}
      aria-valuemin={start ? 0 : moveLoopBoundary(range, "end", 0, duration, fps).end}
      aria-valuemax={start ? moveLoopBoundary(range, "start", duration, duration, fps).start : duration}
      aria-valuenow={time}
      aria-valuetext={timeLabel(time, fps)}
      left={`${(100 * time) / duration}%`}
      onPointerDown={(event) => {
        if (!onChange || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        drag.current = {
          x: event.clientX,
          time,
          width: event.currentTarget.parentElement!.getBoundingClientRect().width,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const origin = drag.current;
        if (origin) change(origin.time + ((event.clientX - origin.x) / origin.width) * duration);
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        if (drag.current) change(drag.current.time);
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onKeyDown={(event) => {
        if (!onChange) return;
        const delta = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        if (delta) {
          event.preventDefault();
          change(time + (delta * (event.shiftKey ? 10 : 1)) / fps);
        }
        if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          change(event.key === "Home" ? 0 : duration);
        }
      }}
    >
      {start ? <ChevronRight /> : <ChevronLeft />}
    </TimelineLoopHandle>
  );
};
export const LoopRange = (props: LoopRangeProps) => (
  <TimelineRow>
    <TimelineLabel type="button" tabIndex={-1}>
      Loop
    </TimelineLabel>
    <TimelineLane>
      <TimelineLoopBand
        left={`${(100 * props.range.start) / props.duration}%`}
        width={`${(100 * (props.range.end - props.range.start)) / props.duration}%`}
      />
      <Boundary {...props} boundary="start" />
      <Boundary {...props} boundary="end" />
    </TimelineLane>
  </TimelineRow>
);
