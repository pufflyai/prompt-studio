import { Button, Flex, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useSyncExternalStore } from "react";
import type { CanvasRuntime } from "../controller/runtime";
export const CanvasToolbar = (props: { runtime: CanvasRuntime }) => {
  const { runtime } = props;
  const zoom = useSyncExternalStore(runtime.subscribe, () => runtime.get().camera.zoom);
  return (
    <Flex
      role="toolbar"
      aria-label="Canvas camera"
      gap="xs"
      align="center"
      wrap="wrap"
      flexShrink="0"
      p="xs"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      bg="bg"
    >
      <Button size="xs" variant="ghost" onClick={() => runtime.zoom(1 / 1.2)} aria-label="Zoom out">
        −
      </Button>
      <Text textStyle="label/XS" aria-live="off">
        {new Intl.NumberFormat(undefined, { maximumSignificantDigits: 3 }).format(zoom * 100)}%
      </Text>
      <Button size="xs" variant="ghost" onClick={() => runtime.zoom(1.2)} aria-label="Zoom in">
        +
      </Button>
      <Button size="xs" variant="ghost" onClick={() => runtime.fit()}>
        Fit all
      </Button>
      <Button size="xs" variant="ghost" onClick={() => runtime.reset()}>
        Reset camera
      </Button>
      <Tooltip
        content="Drag empty space to pan. Space or middle drag pans over previews. Arrow keys move the camera; +/− zoom, F fits and 0 resets when the canvas has focus. Theme follows the workbench."
        openDelay={300}
      >
        <Button size="xs" variant="ghost" aria-label="Canvas help">
          ?
        </Button>
      </Tooltip>
    </Flex>
  );
};
