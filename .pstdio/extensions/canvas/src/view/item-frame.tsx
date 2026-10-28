import { Box, Button, Flex, Icon, Text } from "@chakra-ui/react";
import { resolveIconComponent, Tooltip } from "@pstdio/ui";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CanvasItem } from "../canvases/definitions";
import type { CanvasRuntime } from "../controller/runtime";
import { FramePreview } from "../frames/frame";
import { FrameThemePicker } from "./frame-theme-picker";
import { FrameVariantPicker } from "./frame-variant-picker";

const Grip = resolveIconComponent("grip-vertical")!;

interface ItemProps {
  item: CanvasItem;
  runtime: CanvasRuntime;
}
export const ItemFrame = (props: ItemProps) => {
  const { item, runtime } = props;
  const selected = useSyncExternalStore(runtime.selection.subscribe, () => runtime.selection.get() === item.id);
  const [variantId, setVariantId] = useState(item.variants?.[0]?.id);
  const variant = item.variants?.find((entry) => entry.id === variantId);
  const selectedItem = variant ? { ...item, preview: variant.preview } : item;
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
      data-canvas-selected={selected}
      data-canvas-control
      onClickCapture={() => runtime.select(item.id)}
      ref={wrapper}
      position="absolute"
      top="0"
      left="0"
      w={`${item.width}px`}
      borderRadius="xs"
      outline={selected ? "2px solid" : "none"}
      outlineColor="border.accent"
      outlineOffset="2px"
    >
      <Flex align="center" gap="xs" wrap="wrap" pb="xs" cursor="default">
        <Tooltip content="Move with the arrow keys. Hold Shift for larger steps." openDelay={300}>
          <Button
            variant="ghost-static"
            size="sm"
            cursor="default"
            data-canvas-handle={item.id}
            aria-label={`Move ${item.name}`}
            touchAction="none"
            aria-describedby="canvas-instructions"
          >
            <Icon as={Grip} boxSize="icon-md" />
          </Button>
        </Tooltip>
        <Tooltip content="Copy this name to reference the design" openDelay={300}>
          <Button variant="display-link" size="xs" cursor="default" onClick={() => void copy()} aria-label={item.name}>
            {item.name}
          </Button>
        </Tooltip>
        <FrameThemePicker id={item.id} name={item.name} runtime={runtime} />
        {variant && <FrameVariantPicker item={item} selected={variant} onSelect={setVariantId} />}
        <Text role="status" aria-live="polite" textStyle="label/XS" color="fg.muted">
          {feedback}
        </Text>
        {feedback === "Select and copy the name" && (
          <Text tabIndex={0} userSelect="text" textStyle="label/S/medium">
            {item.name}
          </Text>
        )}
      </Flex>
      <Box
        minH={`${item.height}px`}
        position="relative"
        display="flow-root"
        borderWidth="1px"
        borderColor="border.subtle"
        bg="bg"
        borderRadius="xs"
        data-canvas-preview={item.id}
      >
        <Box inert={!selected} pointerEvents={selected ? "auto" : "none"}>
          <FramePreview key={variantId} item={selectedItem} runtime={runtime} />
        </Box>
        {!selected && (
          <Button
            position="absolute"
            inset="0"
            w="full"
            h="full"
            p="0"
            variant="ghost-static"
            cursor="default"
            aria-label={`Select ${item.name}`}
            aria-describedby="canvas-instructions"
            data-canvas-select
            onClick={() => runtime.select(item.id)}
          >
            <Text srOnly>Select {item.name} to interact</Text>
          </Button>
        )}
      </Box>
    </Box>
  );
};
