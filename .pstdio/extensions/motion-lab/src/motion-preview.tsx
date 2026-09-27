import { Box, Flex } from "@chakra-ui/react";
import { compositions } from "@pstdio/motion-studies";
import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef } from "react";
import { PlayerControls } from "./player-controls";
import { useReview } from "./review-context";
import { loopBounds, playbackPosition } from "./review-state";

export const MotionPreview = () => {
  const { state } = useReview();
  const { settings } = state;
  const player = useRef<PlayerRef>(null);
  const entry = compositions.find(
    (item) => item.defaultProps.study === settings.study && item.defaultProps.comparison === settings.comparison,
  )!;
  const { start, end } = loopBounds(state);
  useEffect(() => {
    const position = playbackPosition(state, Date.now());
    player.current?.seekTo(position.frame);
    if (position.playing) player.current?.play();
    else player.current?.pause();
  }, [state]);
  return (
    <Flex direction="column" h="full" minH="0" minW="0" overflow="hidden">
      <Box className={settings.theme} position="relative" flex="1" minH="0" minW="0" overflow="hidden" bg="bg.subtle">
        <Player
          ref={player}
          // Keep composition dimensions out of flex sizing; Remotion fits this available area.
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          component={entry.component}
          inputProps={settings}
          durationInFrames={entry.durationInFrames}
          fps={entry.fps}
          compositionWidth={entry.width}
          compositionHeight={entry.height}
          playbackRate={state.rate}
          loop={state.loop}
          inFrame={state.loop && state.playing ? start : undefined}
          outFrame={state.loop && state.playing ? end : undefined}
          autoPlay={false}
          moveToBeginningWhenEnded={false}
          controls={false}
          clickToPlay={false}
          numberOfSharedAudioTags={0}
        />
      </Box>
      <PlayerControls />
    </Flex>
  );
};
