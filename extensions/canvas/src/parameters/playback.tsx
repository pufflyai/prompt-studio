import { Box, Stack } from "@chakra-ui/react";
import { type KeyframeLoopRange, KeyframeTimeline, moveLoopBoundary } from "@pstdio/ui/keyframe-timeline";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FrameAnimationOutlet } from "./editor-outlet";
import { type FrameParameters, nextPlaybackTime, type Values } from "./model";
import type { PlaybackSettings } from "./review";

interface PlaybackProps {
  active: boolean;
  name: string;
  frameId: string;
  motion: NonNullable<FrameParameters["motion"]>;
  onChange: (values: Values) => void;
  restored?: PlaybackSettings;
  onInteraction: () => void;
}
export const Playback = (props: PlaybackProps) => {
  const { motion, onChange } = props;
  const outlet = useContext(FrameAnimationOutlet);
  const tray = useRef<HTMLDivElement>(null);
  const register = outlet?.setActiveFrame;
  const reportHeight = outlet?.reportHeight;
  const open = outlet?.open;
  useEffect(() => {
    if (!props.active || !register) return;
    register(props.frameId);
    return () => register((current) => (current === props.frameId ? undefined : current));
  }, [props.active, props.frameId, register]);
  useLayoutEffect(() => {
    const node = tray.current;
    if (!node || !props.active || !open || !reportHeight) return;
    const measure = () => {
      const height = node.getBoundingClientRect().height;
      if (height > 0) reportHeight(height);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [props.active, open, reportHeight]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [rate, setRate] = useState(1);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(motion.duration);
  const clock = useRef(0);
  const send = useRef(onChange);
  const touched = useRef(false);
  const interact = () => {
    touched.current = true;
    props.onInteraction();
  };
  useEffect(() => {
    send.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!props.restored || touched.current) return;
    const saved = props.restored;
    clock.current = saved.time;
    setTime(saved.time);
    setRate(saved.rate);
    setLoop(saved.loop);
    setStart(saved.start);
    setEnd(saved.end);
    send.current({ time: saved.time });
  }, [props.restored]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      if (document.hidden) {
        setPlaying(false);
        return;
      }
      clock.current = nextPlaybackTime(clock.current, ((now - previous) / 1000) * rate, start, end, loop);
      previous = now;
      setTime(clock.current);
      send.current({ time: clock.current });
      if (!loop && clock.current >= end) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, loop, rate, start, end]);
  const seek = (value: number) => {
    interact();
    setPlaying(false);
    clock.current = value;
    setTime(value);
    onChange({ time: value });
  };
  const changeRange = (range: KeyframeLoopRange) => {
    setStart(range.start);
    setEnd(range.end);
    seek(Math.max(range.start, Math.min(clock.current, range.end)));
  };
  if (!props.active || !outlet?.element || !outlet.open) return null;
  return createPortal(
    <Box ref={tray} maxH="40vh" minH="0" data-frame-playback={props.name}>
      <KeyframeTimeline
        label={`Animations · ${props.name}`}
        maxHeight={outlet.heightLimit}
        tracks={[{ id: "animation", label: "Animation", keyframes: [] }]}
        duration={motion.duration}
        framesPerSecond={motion.fps ?? 60}
        currentTime={time}
        onTimeChange={seek}
        onRestart={() => seek(start)}
        playing={playing}
        onPlayingChange={(next: boolean) => {
          interact();
          if (next && (clock.current >= end || clock.current < start)) {
            clock.current = start;
            setTime(start);
          }
          setPlaying(next);
        }}
        loopRange={{ start, end }}
        onLoopRangeChange={changeRange}
        markers={motion.markers?.map((marker) => ({
          id: `${marker.at}:${marker.label}`,
          time: marker.at,
          label: marker.label,
        }))}
        settings={
          <Stack gap="sm" p="sm" data-frame-animation-settings>
            <ParamEditor
              params={[
                { id: "loop", type: "boolean", name: "Loop", defaultValue: loop },
                {
                  id: "rate",
                  type: "selection",
                  name: "Speed",
                  defaultValue: String(rate),
                  options: [0.25, 0.5, 1, 1.5, 2].map((value) => ({ id: String(value), name: `${value}×` })),
                },
                {
                  id: "start",
                  type: "number",
                  name: "Loop start",
                  min: 0,
                  max: moveLoopBoundary({ start, end }, "start", motion.duration, motion.duration, motion.fps ?? 60)
                    .start,
                  step: 1 / (motion.fps ?? 60),
                  defaultValue: start,
                },
                {
                  id: "end",
                  type: "number",
                  name: "Loop end",
                  min: moveLoopBoundary({ start, end }, "end", 0, motion.duration, motion.fps ?? 60).end,
                  max: motion.duration,
                  step: 1 / (motion.fps ?? 60),
                  defaultValue: end,
                },
              ]}
              onChange={(id, value) => {
                if (id === "start" || id === "end") {
                  changeRange(moveLoopBoundary({ start, end }, id, Number(value), motion.duration, motion.fps ?? 60));
                  return;
                }
                interact();
                if (id === "loop") setLoop(Boolean(value));
                if (id === "rate") setRate(Number(value));
              }}
            />
          </Stack>
        }
      />
    </Box>,
    outlet.element,
  );
};
