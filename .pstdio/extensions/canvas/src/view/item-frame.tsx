import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CanvasItem } from "../canvases/definitions";
import type { CanvasRuntime } from "../controller/runtime";
import { FramePreview } from "../frames/frame";
import { FrameThemePicker } from "./frame-theme-picker";

interface ItemProps {
  item: CanvasItem;
  runtime: CanvasRuntime;
}
export const ItemFrame = (props: ItemProps) => {
  const { item, runtime } = props;
  const [feedback, setFeedback] = useState<"" | "Copied" | "Select and copy the name">("");
  const wrapper = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    runtime.register(item.id, wrapper.current);
    return () => runtime.register(item.id, null);
  }, [item.id, runtime]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(item.name);
      if (!mounted.current) return;
      setFeedback("Copied");
      timer.current = setTimeout(() => setFeedback(""), 1500);
    } catch {
      if (mounted.current) setFeedback("Select and copy the name");
    }
  };
  return (
    <Box
      data-canvas-item={item.id}
      data-canvas-control
      ref={wrapper}
      position="absolute"
      top="0"
      left="0"
      w={`${item.width}px`}
    >
      <Flex align="center" gap="xs" wrap="wrap" pb="xs" cursor="default">
        <Tooltip content="Move with the arrow keys. Hold Shift for larger steps." openDelay={300}>
          <Button
            variant="ghost-static"
            size="xs"
            cursor="default"
            data-canvas-handle={item.id}
            aria-label={`Move ${item.name}`}
            touchAction="none"
            aria-describedby="canvas-instructions"
          >
            ⠿
          </Button>
        </Tooltip>
        <Tooltip content="Copy this name to reference the design" openDelay={300}>
          <Button variant="display-link" size="xs" cursor="default" onClick={() => void copy()} aria-label={item.name}>
            {item.name}
          </Button>
        </Tooltip>
        <FrameThemePicker id={item.id} name={item.name} runtime={runtime} />
        <Text role="status" aria-live="polite" textStyle="label/XS" color="fg.muted">
          {feedback}
        </Text>
        {item.preview?.kind === "design" && (
          <Text textStyle="label/XS" color="fg.muted">
            Design reference
          </Text>
        )}
        {feedback === "Select and copy the name" && (
          <Text tabIndex={0} userSelect="text" textStyle="label/S/medium">
            {item.name}
          </Text>
        )}
      </Flex>
      <Box
        minH={`${item.height}px`}
        display="flow-root"
        borderWidth="1px"
        borderColor="border.subtle"
        bg="bg"
        borderRadius="xs"
        data-canvas-preview={item.id}
      >
        <FramePreview item={item} runtime={runtime} />
      </Box>
    </Box>
  );
};
