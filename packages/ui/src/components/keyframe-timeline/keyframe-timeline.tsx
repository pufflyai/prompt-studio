import { Box, IconButton, Text, useRecipe } from "@chakra-ui/react";
import { ChevronRight, DiamondMinus, DiamondPlus, Pause, Play, RotateCcw } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { keyframeTimelineMetrics as metrics } from "../../theme/primitives/keyframe-timeline";
import { ScrollArea } from "../primitives/scroll-area";
import { Tooltip } from "../primitives/tooltip";
import { TreeListReveal } from "../tree-list/tree-list-reveal";
import { KeyframeButton } from "./keyframe-button";
import { editKeyframe, sampleTrack, selectedKeyframe, snapTime, timeLabel } from "./keyframe-model";
import type {
  AnimationKeyframe,
  KeyframeSelection,
  KeyframeTimelineProps,
  KeyframeTrack,
} from "./keyframe-timeline.types";
import { LoopRange } from "./loop-range";
import {
  TimelineDiamond,
  TimelineGroup,
  TimelineKey,
  TimelineLabel,
  TimelineLane,
  TimelinePlayhead,
  TimelinePlayheadHandle,
  TimelineRoot,
  TimelineRow,
  TimelineRuler,
  TimelineTick,
  TimelineToolbar,
} from "./timeline-parts";
import { TimelineSettings } from "./timeline-settings";
import { useTimelineScrub } from "./use-timeline-scrub";

export const KeyframeTimeline = (props: KeyframeTimelineProps) => {
  const { tracks, duration, currentTime, framesPerSecond: fps = 60 } = props;
  const chevron = useRecipe({ key: "treeChevron" });
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const ruler = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [localSelection, setLocalSelection] = useState<KeyframeSelection | null>(null);
  const [trackId, setTrackId] = useState(tracks[0]?.id);
  const selection = props.selection === undefined ? localSelection : props.selection;
  const track =
    tracks.find((entry) => entry.id === selection?.trackId) ??
    tracks.find((entry) => entry.id === trackId) ??
    tracks[0];
  const selected = selectedKeyframe(tracks, selection)?.keyframe;
  const width = Math.max(metrics.minimumWidth, duration * metrics.pixelsPerSecond);
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
  const seek = (time: number) => props.onTimeChange(Math.max(0, Math.min(duration, time)));
  // Timing input snaps to frames; selecting authored keys and markers keeps their original time.
  const seekFrame = (time: number) => seek(snapTime(time, duration, fps));
  const scrub = useTimelineScrub({ ruler, duration, onSeek: seekFrame });
  const groups = [...new Set(tracks.map((entry) => entry.group ?? ""))];
  const step = 10 ** Math.floor(Math.log10(Math.max(duration / (width / metrics.pixelsPerSecond), 1 / fps)));
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, index) => index * step);
  const playhead = `${(100 * Math.max(0, Math.min(duration, currentTime))) / duration}%`;
  return (
    <TimelineRoot
      role="region"
      aria-label={props.label ?? "Animation timeline"}
      maxH={props.maxHeight === undefined ? undefined : `${props.maxHeight}px`}
    >
      <TimelineToolbar role="toolbar" aria-label="Animation controls">
        {props.onPlayingChange && (
          <Tooltip content={props.playing ? "Pause" : "Play"}>
            <IconButton
              size="xs"
              variant="ghost"
              aria-label={props.playing ? "Pause" : "Play"}
              onClick={() => props.onPlayingChange?.(!props.playing)}
            >
              {props.playing ? <Pause /> : <Play />}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip content="Restart">
          <IconButton
            size="xs"
            variant="ghost"
            aria-label="Restart"
            onClick={() => {
              props.onPlayingChange?.(false);
              if (props.onRestart) props.onRestart();
              else seek(0);
            }}
          >
            <RotateCcw />
          </IconButton>
        </Tooltip>
        <Text textStyle="mono/XS" role="timer">
          {timeLabel(currentTime, fps)} / {timeLabel(duration, fps)}
        </Text>
        <Box flex="1" />
        {props.onTracksChange && (
          <>
            <Tooltip content="Add keyframe">
              <IconButton
                size="xs"
                variant="ghost"
                aria-label="Add keyframe"
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
                <DiamondPlus />
              </IconButton>
            </Tooltip>
            <Tooltip content="Delete keyframe">
              <IconButton
                size="xs"
                variant="ghost"
                aria-label="Delete keyframe"
                disabled={!selected}
                onClick={() => {
                  if (track && selected) remove(track, selected.id);
                }}
              >
                <DiamondMinus />
              </IconButton>
            </Tooltip>
          </>
        )}
        {props.settings && <TimelineSettings>{props.settings}</TimelineSettings>}
      </TimelineToolbar>
      <ScrollArea flex="0 1 auto" minH="0" showHorizontalScrollbar role="group" aria-label="Animation tracks">
        <Box position="relative" minW="full" w={`${width + metrics.labelWidth}px`} {...scrub}>
          <TimelinePlayheadHandle
            aria-hidden="true"
            left={`calc(${Math.max(0, Math.min(1, currentTime / duration)) * 100}% + ${(1 - currentTime / duration) * metrics.labelWidth + (1 - (2 * currentTime) / duration) * metrics.inset}px)`}
          >
            <TimelinePlayhead left="50%" />
          </TimelinePlayheadHandle>
          <TimelineRow position="sticky" top="0" zIndex="4">
            <TimelineLabel type="button" tabIndex={-1}>
              Time
            </TimelineLabel>
            <TimelineRuler
              ref={ruler}
              role="slider"
              tabIndex={0}
              aria-label="Timeline playhead"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              aria-valuetext={timeLabel(currentTime, fps)}
              onKeyDown={(event) => {
                const change = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
                if (change) {
                  event.preventDefault();
                  seekFrame(currentTime + (change * (event.shiftKey ? 10 : 1)) / fps);
                }
                if (event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  seekFrame(event.key === "Home" ? 0 : duration);
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
          {props.loopRange && (
            <LoopRange range={props.loopRange} duration={duration} fps={fps} onChange={props.onLoopRangeChange} />
          )}
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
                  <Box asChild css={chevron()} data-open={!collapsed.includes(group)}>
                    <ChevronRight aria-hidden="true" />
                  </Box>
                  {group}
                </TimelineGroup>
              )}
              <TreeListReveal open={!collapsed.includes(group)}>
                {tracks
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
              </TreeListReveal>
            </Fragment>
          ))}
          {!!props.markers?.length && (
            <TimelineRow>
              <TimelineLabel type="button" tabIndex={-1}>
                Markers
              </TimelineLabel>
              <TimelineLane>
                {props.markers.map((marker) => (
                  <Tooltip key={marker.id} content={marker.label}>
                    <TimelineKey
                      type="button"
                      aria-label={marker.label}
                      left={`${(100 * marker.time) / duration}%`}
                      onClick={() => seek(marker.time)}
                    >
                      <TimelineDiamond />
                    </TimelineKey>
                  </Tooltip>
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
