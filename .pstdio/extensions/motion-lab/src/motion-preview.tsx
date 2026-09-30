import { Box, Flex } from "@chakra-ui/react";
import { Player, type PlayerRef } from "@remotion/player";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { MotionStudy } from "./kit/composition";
import { FPS, type SceneProps } from "./kit/model";
import { PlayerControls } from "./player-controls";
import { useReview } from "./review-context";
import { loopBounds, playbackPosition } from "./review-state";
import { SceneBoundary } from "./scene-boundary";
import { loadScene } from "./scene-loader";
import { StudyStatus } from "./study-status";
export const MotionPreview = () => {
  const { state, study, module, hash } = useReview();
  const { settings } = state;
  const player = useRef<PlayerRef>(null);
  const [loaded, setLoaded] = useState<{ hash: string; Scene: ComponentType<SceneProps> }>();
  const [error, setError] = useState<string>();
  const code = "code" in module ? module.code : undefined;
  useEffect(() => {
    let active = true;
    setError(undefined);
    if (code)
      void loadScene(code)
        .then((Scene) => {
          if (active) setLoaded({ hash, Scene });
        })
        .catch((reason) => {
          if (active) setError(String(reason));
        });
    return () => {
      active = false;
    };
  }, [code, hash]);
  const { start, end, max } = loopBounds(state, study.duration);
  useEffect(() => {
    if (!loaded || loaded.hash !== hash) return;
    const position = playbackPosition(state, Date.now(), study.duration);
    player.current?.seekTo(position.frame);
    if (position.playing) player.current?.play();
    else player.current?.pause();
  }, [state, study.duration, loaded, hash]);
  if ("error" in module) {
    const { message, file, line, column } = module.error;
    return <StudyStatus message={`${[file, line, column].filter((v) => v !== undefined).join(":")} ${message}`} />;
  }
  if (error) return <StudyStatus message={error} />;
  if (!loaded || loaded.hash !== hash) return null;
  return (
    <Flex direction="column" h="full" minH="0" minW="0" overflow="hidden">
      <Box className={settings.theme} position="relative" flex="1" minH="0" minW="0" overflow="hidden" bg="bg.subtle">
        <SceneBoundary key={hash}>
          <Player
            ref={player}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            component={MotionStudy}
            inputProps={{ ...settings, Scene: loaded.Scene, canvas: study.canvas }}
            durationInFrames={max + 1}
            fps={FPS}
            compositionWidth={settings.comparison ? 1920 : 1440}
            compositionHeight={settings.comparison ? 1080 : 900}
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
        </SceneBoundary>
      </Box>
      <PlayerControls />
    </Flex>
  );
};
