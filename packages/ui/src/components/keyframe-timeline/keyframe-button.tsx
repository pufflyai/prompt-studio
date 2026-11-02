import { DiamondMinus } from "lucide-react";
import { useRef } from "react";
import { ResourceContextMenu } from "../overlays/resource-context-menu";
import { timeLabel } from "./keyframe-model";
import type { AnimationKeyframe, KeyframeTrack } from "./keyframe-timeline.types";
import { TimelineDiamond, TimelineKey } from "./timeline-parts";

interface Props {
  track: KeyframeTrack;
  keyframe: AnimationKeyframe;
  duration: number;
  fps: number;
  selected: boolean;
  editable: boolean;
  autoFocus?: boolean;
  select: () => void;
  move: (time: number) => void;
  remove: () => void;
}
export const KeyframeButton = (props: Props) => {
  const { track, keyframe: key, duration, fps } = props;
  const drag = useRef<{ x: number; time: number; width: number } | null>(null);
  return (
    <ResourceContextMenu
      actions={
        props.editable
          ? [
              {
                key: "delete",
                label: "Delete keyframe",
                group: {
                  id: track.id,
                  label: `${[track.group, track.label].filter(Boolean).join(" / ")} · ${timeLabel(key.time, fps)}`,
                },
                icon: <DiamondMinus />,
                onClick: props.remove,
              },
            ]
          : []
      }
    >
      <TimelineKey
        type="button"
        data-keyframe=""
        autoFocus={props.autoFocus}
        onContextMenuCapture={props.select}
        aria-label={`${track.label} keyframe ${timeLabel(key.time, fps)}`}
        aria-pressed={props.selected}
        aria-description={
          props.editable
            ? "Arrow keys move one frame; Shift moves ten. Delete removes the keyframe. Shift+F10 opens actions."
            : "Read-only keyframe"
        }
        left={`${(100 * key.time) / duration}%`}
        onClick={props.select}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          props.select();
          if (!props.editable) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          drag.current = {
            x: event.clientX,
            time: key.time,
            width: event.currentTarget.parentElement!.getBoundingClientRect().width,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (start) props.move(start.time + ((event.clientX - start.x) / start.width) * duration);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          if (drag.current) props.move(drag.current.time);
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          if (!props.editable) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            props.move(key.time + ((event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 10 : 1)) / fps);
          }
          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            props.remove();
          }
        }}
      >
        <TimelineDiamond />
      </TimelineKey>
    </ResourceContextMenu>
  );
};
