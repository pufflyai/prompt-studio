import { Box, IconButton, Text, useRecipe } from "@chakra-ui/react";
import { ChevronRight, Pause, Play, Repeat, RotateCcw } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { keyframeTimelineMetrics as metrics } from "../../theme/primitives/keyframe-timeline";
import { ScrollArea } from "../primitives/scroll-area";
import { Tooltip } from "../primitives/tooltip";
import { TreeListReveal } from "../tree-list/tree-list-reveal";
import { editKeyframe, sampleTrack, snapTime, timeLabel } from "./keyframe-model";
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
  TimelineTicks,
  TimelineToolbar,
} from "./timeline-parts";
import { TimelineSettings } from "./timeline-settings";
import { TimelineTrack } from "./timeline-track";
import { useTimelineScrub } from "./use-timeline-scrub";
import { useTimelineZoom } from "./use-timeline-zoom";

export const KeyframeTimeline = (props: KeyframeTimelineProps) => {
  const { tracks, duration, framesPerSecond: fps = 60 } = props;
  const currentTime = Math.max(0, Math.min(duration, props.currentTime));
  const chevron = useRecipe({ key: "treeChevron" });
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const ruler = useRef<HTMLDivElement>(null);
  const playheadHandle = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [localSelection, setLocalSelection] = useState<KeyframeSelection | null>(null);
  const [trackId, setTrackId] = useState(tracks[0]?.id);
  const selection = props.selection === undefined ? localSelection : props.selection;
  const track =
    tracks.find((entry) => entry.id === selection?.trackId) ??
    tracks.find((entry) => entry.id === trackId) ??
    tracks[0];
  const { width, viewportRef } = useTimelineZoom(ruler, duration);
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
    setTrackId(owner.id);
    select(null);
    labels.current.get(owner.id)?.focus({ preventScroll: true });
  };
  const add = (owner: KeyframeTrack, time: number) => {
    const key = { id: crypto.randomUUID(), time: snapTime(time, duration, fps), value: sampleTrack(owner, time) };
    update({ ...owner, keyframes: [...owner.keyframes, key].sort((a, b) => a.time - b.time) });
    setTrackId(owner.id);
    select({ trackId: owner.id, keyframeId: key.id });
    props.onTimeChange(key.time);
    return key.id;
  };
  const seek = (time: number) => props.onTimeChange(Math.max(0, Math.min(duration, time)));
  // Timing input snaps to frames; selecting authored keys and markers keeps their original time.
  const seekFrame = (time: number) => seek(snapTime(time, duration, fps));
  const scrub = useTimelineScrub({ ruler, playheadHandle, duration, onSeek: seekFrame });
  const groups = [...new Set(tracks.map((entry) => entry.group ?? ""))];
  const step = 10 ** Math.floor(Math.log10(Math.max(duration / (width / metrics.pixelsPerSecond), 1 / fps)));
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, index) => index * step);
  const captionEvery =
    [1, 2, 5, 10].find((multiple) => (width * step * multiple) / duration >= metrics.pixelsPerSecond) ?? 10;
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
        {props.onLoopChange && (
          <Tooltip content="Loop playback">
            <IconButton
              size="xs"
              variant="ghost"
              aria-label="Loop playback"
              aria-pressed={!!props.loop}
              onClick={() => props.onLoopChange?.(!props.loop)}
            >
              <Repeat />
            </IconButton>
          </Tooltip>
        )}
        <Text textStyle="mono/XS" role="timer">
          {timeLabel(currentTime, fps)} / {timeLabel(duration, fps)}
        </Text>
        <Box flex="1" />
        {props.settings && <TimelineSettings>{props.settings}</TimelineSettings>}
      </TimelineToolbar>
      <ScrollArea
        viewportRef={viewportRef}
        flex="0 1 auto"
        minH="0"
        showHorizontalScrollbar
        role="group"
        aria-label="Animation tracks"
      >
        <Box position="relative" minW="full" w={`${width + metrics.labelWidth}px`} {...scrub}>
          <TimelinePlayheadHandle
            ref={playheadHandle}
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
              <TimelineTicks>
                {ticks.map((time, index) => (
                  <TimelineTick
                    key={time}
                    data-end={index > 0 && index === ticks.length - 1}
                    left={`${(100 * time) / duration}%`}
                  >
                    {(index === 0 ||
                      index === ticks.length - 1 ||
                      (index % captionEvery === 0 &&
                        ((ticks.length - 1 - index) * width * step) / duration >= metrics.pixelsPerSecond)) && (
                      <span>{time.toFixed(2)}</span>
                    )}
                  </TimelineTick>
                ))}
              </TimelineTicks>
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
                  data-timeline-group=""
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
                    <TimelineTrack
                      key={entry.id}
                      track={entry}
                      duration={duration}
                      currentTime={currentTime}
                      fps={fps}
                      active={track?.id === entry.id}
                      selection={selection}
                      editable={!!props.onTracksChange}
                      labelRef={(element) => {
                        if (element) labels.current.set(entry.id, element);
                        else labels.current.delete(entry.id);
                      }}
                      activate={() => {
                        setTrackId(entry.id);
                        select(null);
                      }}
                      add={(time) => add(entry, time)}
                      select={(key) => {
                        setTrackId(entry.id);
                        select({ trackId: entry.id, keyframeId: key.id });
                        seek(key.time);
                      }}
                      move={(key, time) => edit(entry, key, { time })}
                      remove={(id) => remove(entry, id)}
                    />
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
