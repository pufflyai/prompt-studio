import "@pstdio/ui/style.css";
import { Box, Flex } from "@chakra-ui/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { type ComponentType, useEffect, useState } from "react";
import { useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import type { StudyMetadata } from "../study-schema";
import { FPS, type SceneProps, type StudyProps, type Variant } from "./model";
export interface CompositionProps extends StudyProps {
  Scene: ComponentType<SceneProps>;
  canvas: StudyMetadata["canvas"];
}
const StudyPane = (props: { settings: CompositionProps; variant: Variant; time: number }) => {
  const { settings, variant, time } = props;
  const { width, height } = useVideoConfig();
  const { Scene, canvas } = settings;
  const sceneProps: SceneProps = {
    time,
    variant,
    reducedMotion: settings.reducedMotion,
  };
  if (canvas !== "pane") {
    const sceneWidth = canvas === "workbench" ? 1440 : canvas.width;
    const sceneHeight = canvas === "workbench" ? 900 : canvas.height;
    const paneWidth = settings.comparison ? (width - 48) / 2 : width - 32;
    const scale = Math.min(paneWidth / sceneWidth, (height - 32) / sceneHeight);
    return (
      <Flex flex="1" minW="0" minH="0" align="center" justify="center" overflow="hidden" pointerEvents="none">
        <Box w={`${sceneWidth * scale}px`} h={`${sceneHeight * scale}px`} flexShrink="0">
          <Box w={`${sceneWidth}px`} h={`${sceneHeight}px`} transform={`scale(${scale})`} transformOrigin="top left">
            <Scene {...sceneProps} />
          </Box>
        </Box>
      </Flex>
    );
  }
  return (
    <Box flex="1" minW="0" minH="0" pointerEvents="none">
      <Scene {...sceneProps} />
    </Box>
  );
};
export const MotionStudy = (props: CompositionProps) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [fontHandle] = useState(() => delayRender("Load shared UI fonts"));
  useEffect(() => {
    Promise.all([document.fonts.load("400 14px Inter"), document.fonts.load("500 14px Onest")])
      .then(() => continueRender(fontHandle))
      .catch(cancelRender);
  }, [fontHandle, continueRender, cancelRender]);
  const time = useCurrentFrame() / FPS;
  return (
    <ChakraProvider value={psTheme}>
      <Flex
        className={props.theme}
        data-theme={props.theme}
        h="full"
        w="full"
        bg="bg.subtle"
        color="fg"
        p="md"
        gap="md"
        // The frame clock owns motion; inherited UI transitions must not continue while paused.
        css={{
          "& *, & *::before, & *::after": {
            animation: "none !important",
            transition: "none !important",
            caretColor: "transparent",
          },
        }}
      >
        {props.comparison && <StudyPane settings={props} variant={props.left} time={time} />}
        <StudyPane settings={props} variant={props.right} time={time} />
      </Flex>
    </ChakraProvider>
  );
};
