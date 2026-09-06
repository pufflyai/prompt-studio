import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import type { FootageEntry } from "../data/footage-archive";
import { drawFootageFrame } from "./footage-scenes";

interface FootagePlayerProps {
  entry: FootageEntry;
}

export const FootagePlayer = (props: FootagePlayerProps) => {
  const { entry } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  // The animation loop reads mutable playback state from a ref so a 24fps clip does not
  // re-render React on every frame; the timecode is burned into the canvas instead.
  const playbackRef = useRef({ playing: true, elapsed: 0, glitchUntil: 0, lastFrameAt: 0 });

  useEffect(() => {
    playbackRef.current.playing = playing;
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const playback = playbackRef.current;
    playback.elapsed = 0;
    playback.lastFrameAt = 0;
    playback.glitchUntil = performance.now() + 420;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let frame = 0;
    const loop = (now: number) => {
      const delta = playback.lastFrameAt ? (now - playback.lastFrameAt) / 1000 : 0;
      playback.lastFrameAt = now;
      if (playback.playing) playback.elapsed = (playback.elapsed + delta) % entry.durationSeconds;
      drawFootageFrame(context, entry, {
        width: canvas.width,
        height: canvas.height,
        elapsed: playback.elapsed,
        playing: playback.playing,
        glitching: now < playback.glitchUntil,
        now,
      });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [entry]);

  return (
    <Stack gap="sm" h="full" minH="0">
      <Box flex="1" minH="0" borderRadius="md" overflow="hidden" bg="bg.inverted">
        <Box as="canvas" ref={canvasRef} display="block" w="full" h="full" />
      </Box>
      <HStack gap="md" flexShrink={0}>
        <Button type="button" size="sm" variant="outline" onClick={() => setPlaying((value) => !value)}>
          {playing ? "Pause" : "Play"}
        </Button>
        <Stack gap="0" minW="0">
          <Text textStyle="label/S/medium" truncate>
            {entry.label}
          </Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted" truncate>
            {entry.camera} · {entry.durationSeconds}s loop
          </Text>
        </Stack>
      </HStack>
    </Stack>
  );
};
