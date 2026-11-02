import { Box, Button, Text } from "@chakra-ui/react";
import { Fragment, useRef, useState } from "react";
import { keyframeTimelineMetrics as metrics } from "../../theme/primitives/keyframe-timeline";
import { ScrollArea } from "../primitives/scroll-area";
import { KeyframeButton } from "./keyframe-button";
import { KeyframeInspector } from "./keyframe-inspector";
import { editKeyframe, sampleTrack, selectedKeyframe, snapTime, timeLabel } from "./keyframe-model";
import type {
  AnimationKeyframe,
  KeyframeSelection,
  KeyframeTimelineProps,
  KeyframeTrack,
} from "./keyframe-timeline.types";
import {
  TimelineGroup,
  TimelineLabel,
  TimelineLane,
  TimelinePlayhead,
  TimelineRoot,
  TimelineRow,
  TimelineRuler,
  TimelineTick,
  TimelineToolbar,
} from "./timeline-parts";

export const KeyframeTimeline = (props: KeyframeTimelineProps) => {
  const { tracks, duration, currentTime, framesPerSecond: fps = 60 } = props;
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [localSelection, setLocalSelection] = useState<KeyframeSelection | null>(null);
  const [trackId, setTrackId] = useState(tracks[0]?.id);
  const selection = props.selection === undefined ? localSelection : props.selection;
  const track =
    tracks.find((entry) => entry.id === selection?.trackId) ??
    tracks.find((entry) => entry.id === trackId) ??
    tracks[0];
  const selected = selectedKeyframe(tracks, selection)?.keyframe;
  const width = Math.max(metrics.minimumWidth, duration * metrics.pixelsPerSecond * zoom);
  const select = (next: KeyframeSelection | null) => {
    setLocalSelection(next);
    props.onSelectionChange?.(next);
  };
  const update = (next: KeyframeTrack) =>
    props.onTracksChange?.(tracks.map((entry) => (entry.id === next.id ? next : entry)));
  const edit = (owner: KeyframeTrack, key: AnimationKeyframe, change: Partial<AnimationKeyframe>) =>
    update(editKeyframe(owner, key.id, change, duration, fps));
  const remove = (owner: KeyframeTrack, id: string) => {
    update({ ...owner, keyframes: owner.keyframes.filter((key) => key.id !== id) });
    select(null);
    labels.current.get(owner.id)?.focus({ preventScroll: true });
  };
  const seek = (time: number) => props.onTimeChange(snapTime(time, duration, fps));
  const groups = [...new Set(tracks.map((entry) => entry.group ?? ""))];
  const step = 10 ** Math.floor(Math.log10(Math.max(duration / (width / metrics.pixelsPerSecond), 1 / fps)));
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, index) => index * step);
  const playhead = `${(100 * Math.max(0, Math.min(duration, currentTime))) / duration}%`;
  return (
    <TimelineRoot role="region" aria-label={props.label ?? "Animation timeline"}>
      <TimelineToolbar>
        <Text flex="1" textStyle="label/S/medium">
          {props.label ?? "Animations"}
        </Text>
        {props.onPlayingChange && (
          <Button size="xs" onClick={() => props.onPlayingChange?.(!props.playing)}>
            {props.playing ? "Pause" : "Play"}
          </Button>
        )}
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            props.onPlayingChange?.(false);
            if (props.onRestart) props.onRestart();
            else seek(0);
          }}
        >
          Restart
        </Button>
        <Text textStyle="mono/XS" role="timer">
          {timeLabel(currentTime, fps)} / {timeLabel(duration, fps)}
        </Text>
        <Button size="xs" aria-label="Zoom out timeline" disabled={zoom <= 0.25} onClick={() => setZoom(zoom / 2)}>
          −
        </Button>
        <Text textStyle="mono/XS">{Math.round(zoom * 100)}%</Text>
        <Button size="xs" aria-label="Zoom in timeline" disabled={zoom >= 8} onClick={() => setZoom(zoom * 2)}>
          +
        </Button>
        {props.onTracksChange && (
          <>
            <Button
              size="xs"
              disabled={
                !track || track.keyframes.some((key) => Math.round(key.time * fps) === Math.round(currentTime * fps))
              }
              onClick={() => {
                if (!track) return;
                const key = {
                  id: crypto.randomUUID(),
                  time: snapTime(currentTime, duration, fps),
                  value: sampleTrack(track, currentTime),
                };
                update({ ...track, keyframes: [...track.keyframes, key].sort((a, b) => a.time - b.time) });
                select({ trackId: track.id, keyframeId: key.id });
              }}
            >
              Add keyframe
            </Button>
            <Button
              size="xs"
              disabled={!selected}
              onClick={() => {
                if (track && selected) remove(track, selected.id);
              }}
            >
              Delete keyframe
            </Button>
          </>
        )}
      </TimelineToolbar>
      {selected && track && props.onTracksChange && (
        <KeyframeInspector
          key={`${track.id}:${selected.id}`}
          track={track}
          keyframe={selected}
          duration={duration}
          fps={fps}
          onChange={update}
        />
      )}
      <ScrollArea flex="1" minH="0" showHorizontalScrollbar>
        <Box position="relative" minW="full" w={`${width + metrics.labelWidth}px`}>
          <TimelinePlayhead
            left={`calc(${Math.max(0, Math.min(1, currentTime / duration)) * 100}% + ${(1 - currentTime / duration) * metrics.labelWidth + (1 - (2 * currentTime) / duration) * metrics.inset}px)`}
          />
          <TimelineRow position="sticky" top="0" zIndex="4">
            <TimelineLabel type="button" tabIndex={-1}>
              Time
            </TimelineLabel>
            <TimelineRuler
              role="slider"
              tabIndex={0}
              aria-label="Timeline playhead"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              aria-valuetext={timeLabel(currentTime, fps)}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                event.currentTarget.focus({ preventScroll: true });
                const bounds = event.currentTarget.getBoundingClientRect();
                seek(((event.clientX - bounds.left) / bounds.width) * duration);
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                seek(((event.clientX - bounds.left) / bounds.width) * duration);
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onKeyDown={(event) => {
                const change = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
                if (change) {
                  event.preventDefault();
                  seek(currentTime + (change * (event.shiftKey ? 10 : 1)) / fps);
                }
                if (event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  seek(event.key === "Home" ? 0 : duration);
                }
              }}
            >
              {ticks.map((time) => (
                <TimelineTick key={time} left={`${(100 * time) / duration}%`}>
                  {time.toFixed(2)}
                </TimelineTick>
              ))}
              <TimelinePlayhead left={playhead} />
            </TimelineRuler>
          </TimelineRow>
          {groups.map((group) => (
            <Fragment key={group}>
              {group && (
                <TimelineGroup
                  type="button"
                  aria-expanded={!collapsed.includes(group)}
                  onClick={() =>
                    setCollapsed(
                      collapsed.includes(group) ? collapsed.filter((entry) => entry !== group) : [...collapsed, group],
                    )
                  }
                >
                  {collapsed.includes(group) ? "▸" : "▾"} {group}
                </TimelineGroup>
              )}
              {!collapsed.includes(group) &&
                tracks
                  .filter((entry) => (entry.group ?? "") === group)
                  .map((entry) => (
                    <TimelineRow key={entry.id}>
                      <TimelineLabel
                        type="button"
                        ref={(element) => {
                          if (element) labels.current.set(entry.id, element);
                          else labels.current.delete(entry.id);
                        }}
                        aria-pressed={track?.id === entry.id}
                        onClick={() => {
                          setTrackId(entry.id);
                          select(null);
                        }}
                      >
                        {entry.label}
                      </TimelineLabel>
                      <TimelineLane>
                        {entry.keyframes.map((key) => (
                          <KeyframeButton
                            key={key.id}
                            track={entry}
                            keyframe={key}
                            duration={duration}
                            fps={fps}
                            selected={selection?.trackId === entry.id && selection.keyframeId === key.id}
                            editable={!!props.onTracksChange}
                            select={() => {
                              setTrackId(entry.id);
                              select({ trackId: entry.id, keyframeId: key.id });
                              seek(key.time);
                            }}
                            move={(time) => edit(entry, key, { time })}
                            remove={() => remove(entry, key.id)}
                          />
                        ))}
                      </TimelineLane>
                    </TimelineRow>
                  ))}
            </Fragment>
          ))}
          {!!props.markers?.length && (
            <TimelineRow>
              <TimelineLabel type="button" tabIndex={-1}>
                Markers
              </TimelineLabel>
              <TimelineLane>
                <TimelinePlayhead left={playhead} />
                {props.markers.map((marker) => (
                  <Button
                    key={marker.id}
                    size="xs"
                    variant="ghost"
                    position="absolute"
                    left={`${(100 * marker.time) / duration}%`}
                    onClick={() => seek(marker.time)}
                  >
                    {marker.label}
                  </Button>
                ))}
              </TimelineLane>
            </TimelineRow>
          )}
          {!tracks.length && !props.markers?.length && (
            <Text p="sm" color="fg.muted">
              No animation tracks
            </Text>
          )}
        </Box>
      </ScrollArea>
    </TimelineRoot>
  );
};
