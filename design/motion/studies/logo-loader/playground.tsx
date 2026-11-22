import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { frameAt, type LoaderSettings, LogoMark } from "./logo-mark";
import type { Outcome } from "./physics";

export interface PlaygroundArgs extends Record<string, unknown> {
  loading: number;
  outcome: Outcome;
  hold: number;
  replay: boolean;
  drum: string;
  bounce: string;
  size: number;
  reducedMotion: boolean;
}

const status = (elapsed: number, args: PlaygroundArgs) => {
  if (args.outcome === "loop") return `Loading ${elapsed.toFixed(1)} s · never resolves`;
  if (elapsed < args.loading) return `Loading ${elapsed.toFixed(1)} / ${args.loading.toFixed(1)} s`;
  return args.outcome === "success" ? "Success" : "Failure";
};

// One loading run on a real-time clock: loading, then the outcome, then a hold before replaying.
const Run = (props: { args: PlaygroundArgs; onDone: () => void }) => {
  const { args, onDone } = props;
  const total = args.outcome === "loop" ? Number.POSITIVE_INFINITY : args.loading + args.hold;
  const [elapsed, setElapsed] = useState(0);
  // The clock reads the latest callback without restarting when the parent re-renders.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const start = performance.now();
    let request = 0;
    const tick = (now: number) => {
      const seconds = (now - start) / 1000;
      if (seconds >= total) {
        setElapsed(total);
        done.current();
        return;
      }
      setElapsed(seconds);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [total]);
  const settings: LoaderSettings = {
    outcome: args.outcome,
    resultAt: args.loading,
    drum: args.drum,
    bounce: args.bounce,
    reducedMotion: args.reducedMotion,
    tempo: 1,
  };
  const frame = frameAt(elapsed, settings);
  return (
    <>
      <Flex flex="1" align="center" justify="center" minH="0">
        <LogoMark frame={frame} size={args.size} />
      </Flex>
      <Flex align="end" gap="lg">
        {[16, 24, 32].map((size) => (
          <Box key={size} display="flex" flexDirection="column" alignItems="center" gap="xs">
            <LogoMark frame={frame} size={size} />
            <Text textStyle="label/XS/regular" color="fg.muted">
              {size}
            </Text>
          </Box>
        ))}
      </Flex>
      <Text textStyle="label/XS/regular" color="fg.muted" fontVariantNumeric="tabular-nums">
        {status(elapsed, args)}
      </Text>
    </>
  );
};

export const LoaderPlayground = (args: PlaygroundArgs) => {
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  // Any setting change starts a fresh run.
  const key = [run, args.loading, args.outcome, args.hold, args.drum, args.bounce, args.reducedMotion].join("|");
  useEffect(() => {
    if (!done || !args.replay) return;
    const timer = setTimeout(() => {
      setDone(false);
      setRun((value) => value + 1);
    }, 0);
    return () => clearTimeout(timer);
  }, [done, args.replay]);
  return (
    <Flex direction="column" align="center" gap="lg" h="420px" bg="bg" px="lg" py="xl">
      <Run key={key} args={args} onDone={() => setDone(true)} />
      <Button
        size="xs"
        variant="outline"
        onClick={() => {
          setDone(false);
          setRun((value) => value + 1);
        }}
      >
        Replay
      </Button>
    </Flex>
  );
};
