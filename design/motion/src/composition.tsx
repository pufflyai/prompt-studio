import "@pstdio/ui/style.css";
import { Box, Flex } from "@chakra-ui/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { FPS, type SceneProps, type StudyProps, type Variant } from "./model";
import { ChatTurn, Loaders } from "./scenes/chat";
import { NavigationTree } from "./scenes/navigation-tree";
import { Panels } from "./scenes/panels";
import { Rows } from "./scenes/rows";
import { Streaming } from "./scenes/streaming";
import { Surfaces } from "./scenes/surfaces";
import { Tabs } from "./scenes/tabs";
import { ToolsQueue } from "./scenes/tools-queue";

const scenes = {
  "chat-turn": ChatTurn,
  loaders: Loaders,
  streaming: Streaming,
  "tools-queue": ToolsQueue,
  panels: Panels,
  surfaces: Surfaces,
  rows: Rows,
  tabs: Tabs,
  "navigation-tree": NavigationTree,
};
const StudyPane = (props: { settings: StudyProps; variant: Variant; time: number }) => {
  const { settings, variant, time } = props;
  const { width, height } = useVideoConfig();
  const Scene = scenes[settings.study];
  const sceneProps: SceneProps = {
    time,
    variant,
    reducedMotion: settings.reducedMotion,
  };
  // Keep design geometry identical across exports and comparison panes.
  const workbench = ["panels", "rows", "tabs"].includes(settings.study);
  const closeup = settings.study === "streaming" || settings.study === "navigation-tree";
  if (workbench || closeup) {
    let sceneWidth = 1440;
    let sceneHeight = 900;
    if (closeup) {
      sceneWidth = settings.study === "streaming" ? 420 : 250;
      sceneHeight = 640;
    }
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
export const MotionStudy = (props: StudyProps) => {
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
