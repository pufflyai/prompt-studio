import { Flex, Stack, Text } from "@chakra-ui/react";
import { Slider } from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useEffect, useRef, useState } from "react";
import { Button } from "../components/themed-primitives";
import { type FrameParameters, nextPlaybackTime, type Values } from "./model";
import type { PlaybackSettings } from "./review";

interface PlaybackProps {
  motion: NonNullable<FrameParameters["motion"]>;
  onChange: (values: Values) => void;
  restored?: PlaybackSettings;
  onInteraction: () => void;
}
export const Playback = (props: PlaybackProps) => {
  const { motion, onChange } = props;
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
  return (
    <Stack gap="sm" p="sm" data-frame-playback>
      <Flex align="center" gap="sm">
        <Button
          size="xs"
          onClick={() => {
            interact();
            if (clock.current >= end) {
              clock.current = start;
              setTime(start);
            }
            setPlaying(!playing);
          }}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <Button size="xs" variant="ghost" onClick={() => seek(start)}>
          Restart
        </Button>
        <Text textStyle="mono/XS">
          {time.toFixed(2)} / {motion.duration.toFixed(2)} s
        </Text>
      </Flex>
      <Slider
        aria-label={["Time"]}
        min={0}
        max={motion.duration}
        step={1 / (motion.fps ?? 60)}
        value={[time]}
        onValueChange={({ value }) => seek(value[0])}
      />
      {!!motion.markers?.length && (
        <Flex gap="sm" wrap="wrap">
          {motion.markers.map((marker) => (
            <Button key={`${marker.at}:${marker.label}`} size="xs" variant="ghost" onClick={() => seek(marker.at)}>
              {marker.label}
            </Button>
          ))}
        </Flex>
      )}
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
            max: end - 1 / (motion.fps ?? 60),
            step: 0.1,
            defaultValue: start,
          },
          {
            id: "end",
            type: "number",
            name: "Loop end",
            min: start + 1 / (motion.fps ?? 60),
            max: motion.duration,
            step: 0.1,
            defaultValue: end,
          },
        ]}
        onChange={(id, value) => {
          interact();
          if (id === "loop") setLoop(Boolean(value));
          if (id === "rate") setRate(Number(value));
          if (id === "start") {
            const next = Math.max(0, Math.min(Number(value), end - 1 / (motion.fps ?? 60)));
            setStart(next);
            seek(next);
          }
          if (id === "end") {
            const next = Math.min(motion.duration, Math.max(Number(value), start + 1 / (motion.fps ?? 60)));
            setEnd(next);
            seek(Math.min(time, next));
          }
        }}
      />
    </Stack>
  );
};
