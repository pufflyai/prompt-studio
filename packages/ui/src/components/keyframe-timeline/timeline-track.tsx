import { DiamondPlus } from "lucide-react";
import { type Ref, useRef, useState } from "react";
import { ResourceContextMenu } from "../overlays/resource-context-menu";
import { KeyframeButton } from "./keyframe-button";
import { snapTime, timeLabel } from "./keyframe-model";
import type { AnimationKeyframe, KeyframeSelection, KeyframeTrack } from "./keyframe-timeline.types";
import { TimelineLabel, TimelineLane, TimelineRow } from "./timeline-parts";

interface Props {
  track: KeyframeTrack;
  duration: number;
  currentTime: number;
  fps: number;
  active: boolean;
  selection: KeyframeSelection | null;
  editable: boolean;
  labelRef: Ref<HTMLButtonElement>;
  activate: () => void;
  add: (time: number) => string;
  select: (key: AnimationKeyframe) => void;
  move: (key: AnimationKeyframe, time: number) => void;
  remove: (id: string) => void;
}

export const TimelineTrack = (props: Props) => {
  const { track, duration, currentTime, fps } = props;
  const lane = useRef<HTMLDivElement>(null);
  const created = useRef<string | null>(null);
  const [menuTime, setMenuTime] = useState(currentTime);
  const path = [track.group, track.label].filter(Boolean).join(" / ");
  return (
    <ResourceContextMenu
      actions={
        props.editable
          ? [
              {
                key: "add",
                label: `Add keyframe at ${timeLabel(menuTime, fps)}`,
                group: { id: track.id, label: path },
                icon: <DiamondPlus />,
                isDisabled: track.keyframes.some((key) => Math.round(key.time * fps) === Math.round(menuTime * fps)),
                onClick: () => {
                  created.current = props.add(menuTime);
                },
              },
            ]
          : []
      }
    >
      <TimelineRow
        role="group"
        aria-label={`${path} track`}
        data-active={props.active}
        onContextMenuCapture={(event) => {
          if (!props.editable) return;
          if (!(event.target as Element).closest("[data-keyframe]")) props.activate();
          const bounds = lane.current?.getBoundingClientRect();
          // Keyboard menus from the label use the playhead; pointer menus use the track position.
          const time =
            bounds && lane.current?.contains(event.target as Node)
              ? snapTime(((event.clientX - bounds.left) / bounds.width) * duration, duration, fps)
              : currentTime;
          setMenuTime(time);
        }}
      >
        <TimelineLabel type="button" ref={props.labelRef} aria-pressed={props.active} onClick={props.activate}>
          {track.label}
        </TimelineLabel>
        <TimelineLane ref={lane}>
          {track.keyframes.map((key) => (
            <KeyframeButton
              key={key.id}
              track={track}
              keyframe={key}
              duration={duration}
              fps={fps}
              selected={props.selection?.trackId === track.id && props.selection.keyframeId === key.id}
              editable={props.editable}
              autoFocus={created.current === key.id}
              select={() => props.select(key)}
              move={(time) => props.move(key, time)}
              remove={() => props.remove(key.id)}
            />
          ))}
        </TimelineLane>
      </TimelineRow>
    </ResourceContextMenu>
  );
};
