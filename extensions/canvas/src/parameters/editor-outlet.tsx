import { Box, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { createContext, type RefCallback, useSyncExternalStore } from "react";
import type { CanvasDefinition } from "../canvas-model";
import type { CanvasRuntime } from "../controller/runtime";

// The portal keeps each editor with its frame's React state while displaying it outside the stage.
export const FrameEditorOutlet = createContext<HTMLElement | null>(null);
interface FrameEditorMenuProps {
  canvas: CanvasDefinition;
  runtime: CanvasRuntime;
  outlet: RefCallback<HTMLDivElement>;
}
export const FrameEditorMenu = (props: FrameEditorMenuProps) => {
  const { canvas, runtime, outlet } = props;
  const selected = useSyncExternalStore(runtime.selection.subscribe, runtime.selection.get);
  const item = canvas.items.find((item) => item.id === selected);
  return (
    <Stack
      as="aside"
      aria-label="Frame editor"
      w="xs"
      maxW="50%"
      flexShrink="0"
      minH="0"
      gap="0"
      bg="bg"
      borderStartWidth="1px"
      borderColor="border.subtle"
    >
      <Stack p="sm" gap="xs" borderBottomWidth="1px" borderColor="border.subtle">
        <Text textStyle="label/M/medium">Frame editor</Text>
        {item && <Text textStyle="label/S/medium">{item.name}</Text>}
      </Stack>
      <ScrollArea flex="1" minH="0">
        {!item && (
          <Text p="sm" color="fg.muted">
            Select a frame
          </Text>
        )}
        <Box ref={outlet} />
      </ScrollArea>
    </Stack>
  );
};
