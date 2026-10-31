import { Box, Button, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { useLayoutEffect, useRef, useState } from "react";
import { ScopedDialog as Dialog, ScopedPopover as Popover } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { ScrollArea } from "../primitives/scroll-area";
import { Canvas } from "./canvas";
import type { CanvasCamera, CanvasNavigation, CanvasPoint, CanvasProps, CanvasZoomChange } from "./canvas.types";
import { zoomCanvas } from "./canvas-geometry";

const PreviewControls = () => {
  const [count, setCount] = useState(0);
  return (
    <Stack gap="md" p="md" data-canvas-control>
      <Text textStyle="heading/S">Live preview</Text>
      <Input aria-label="Preview draft" placeholder="Edit this draft" />
      <Button onClick={() => setCount(count + 1)}>Count {count}</Button>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button>Open popover</Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Body>
                <Input aria-label="Popover draft" placeholder="Portal input" />
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button>Open dialog</Button>
        </Dialog.Trigger>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Preview dialog</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Input aria-label="Dialog draft" placeholder="Portal input" />
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button>Close</Button>
                </Dialog.ActionTrigger>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  );
};

interface FreeformCanvasExampleProps extends Partial<CanvasNavigation>, Pick<CanvasProps, "minZoom" | "maxZoom"> {}

export const FreeformCanvasExample = (props: FreeformCanvasExampleProps) => {
  const { minZoom = 0.1, maxZoom = 4, onPan, onZoom, onFit, onReset, onNavigationEnd } = props;
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const camera = useRef<CanvasCamera>({ x: 24, y: 24, zoom: 1 });
  const frame = useRef(0);
  const [scale, setScale] = useState(1);
  const paint = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const { x, y, zoom } = camera.current;
      if (stage.current) stage.current.style.transform = `translate(${x}px,${y}px) scale(${zoom})`;
    });
  };
  const pan = (delta: CanvasPoint) => {
    camera.current = { ...camera.current, x: camera.current.x + delta.x, y: camera.current.y + delta.y };
    paint();
    onPan?.(delta);
  };
  const zoom = (change: CanvasZoomChange) => {
    camera.current = zoomCanvas(camera.current, change, { minZoom, maxZoom });
    setScale(camera.current.zoom);
    paint();
    onZoom?.(change);
  };
  const reset = () => {
    camera.current = { x: 24, y: 24, zoom: 1 };
    setScale(1);
    paint();
    onReset?.();
  };
  const fit = () => {
    const scale = Math.max(
      minZoom,
      Math.min((viewport.current!.clientWidth - 48) / 800, (viewport.current!.clientHeight - 48) / 380, maxZoom),
    );
    camera.current = { x: 24, y: 24, zoom: scale };
    setScale(scale);
    paint();
    onFit?.();
  };
  useLayoutEffect(() => {
    const { x, y, zoom } = camera.current;
    stage.current!.style.transform = `translate(${x}px,${y}px) scale(${zoom})`;
    return () => cancelAnimationFrame(frame.current);
  }, []);
  return (
    <Canvas
      ref={viewport}
      h="600px"
      aria-label="Live designs canvas"
      zoom={scale}
      minZoom={minZoom}
      maxZoom={maxZoom}
      onPan={pan}
      onZoom={zoom}
      onFit={fit}
      onReset={reset}
      onNavigationEnd={onNavigationEnd}
    >
      <Box ref={stage} position="absolute" top="0" left="0" transformOrigin="0 0" data-example-stage>
        <Box
          position="absolute"
          top="0"
          left="0"
          w="360px"
          h="380px"
          bg="bg"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xs"
          data-canvas-control
        >
          <PreviewControls />
        </Box>
        <Box
          position="absolute"
          top="0"
          left="440px"
          w="360px"
          h="380px"
          bg="bg"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xs"
          data-canvas-control
        >
          <ScrollArea h="full" aria-label="Scrollable preview">
            <Stack p="md" gap="md">
              {Array.from({ length: 20 }, (_, index) => (
                <Text key={index} textStyle="paragraph/S/regular">
                  Preview row {index + 1}
                </Text>
              ))}
            </Stack>
          </ScrollArea>
        </Box>
      </Box>
    </Canvas>
  );
};

export const ScrollCanvasExample = (props: Pick<CanvasProps, "onScroll">) => {
  const { onScroll } = props;
  const viewport = useRef<HTMLDivElement>(null);
  const pending = useRef<CanvasCamera | undefined>(undefined);
  const currentZoom = useRef(1);
  const [{ zoom }, setZoom] = useState({ zoom: 1 });
  const [selected, setSelected] = useState<number>();
  const changeZoom = (change: CanvasZoomChange) => {
    const current = pending.current ?? {
      x: -viewport.current!.scrollLeft,
      y: -viewport.current!.scrollTop,
      zoom: currentZoom.current,
    };
    const next = zoomCanvas(current, change);
    pending.current = next;
    currentZoom.current = next.zoom;
    setZoom({ zoom: next.zoom });
  };
  useLayoutEffect(() => {
    const next = pending.current;
    if (next) viewport.current?.scrollTo({ left: -next.x, top: -next.y });
    pending.current = undefined;
  });
  const pan = (delta: CanvasPoint) => {
    if (pending.current) {
      pending.current = { ...pending.current, x: pending.current.x + delta.x, y: pending.current.y + delta.y };
    } else viewport.current?.scrollBy({ left: -delta.x, top: -delta.y });
  };
  return (
    <Flex h="600px" direction="column" minW="0">
      <Canvas
        ref={viewport}
        flex="1"
        variant="pan"
        aria-label="Timeline canvas"
        zoom={zoom}
        onPan={pan}
        onZoom={changeZoom}
        onScroll={onScroll}
      >
        <Box position="relative" w="2000px" h="1600px" css={{ zoom }} data-example-scroll-content>
          <Flex
            position="sticky"
            top="0"
            left="0"
            zIndex="1"
            gap="md"
            p="md"
            bg="bg"
            borderBottomWidth="1px"
            borderColor="border"
            data-canvas-control
          >
            <Text textStyle="heading/S">Timeline tracks</Text>
            <Input size="xs" aria-label="Track name" defaultValue="Design" w="xs" />
          </Flex>
          <Stack gap="lg" p="lg" w="lg">
            {Array.from({ length: 8 }, (_, index) => (
              <Button
                key={index}
                data-canvas-control
                onClick={() => setSelected(index)}
                aria-pressed={selected === index}
              >
                Ticket {index + 1}
              </Button>
            ))}
          </Stack>
        </Box>
      </Canvas>
    </Flex>
  );
};

export const FlowCanvasExample = () => {
  const [clicked, setClicked] = useState(false);
  const [zoom, setZoom] = useState(1);
  return (
    <Canvas
      aria-label="Flow canvas"
      zoom={zoom}
      onPan={() => {}}
      onZoom={(change) => setZoom((value) => value * change.factor)}
      h="400px"
    >
      <Stack gap="md" p="md" maxW="sm" css={{ zoom }} data-canvas-control>
        <Input aria-label="Flow draft" placeholder="Normal-flow content" />
        <Button onClick={() => setClicked(true)}>{clicked ? "Clicked" : "Click me"}</Button>
      </Stack>
    </Canvas>
  );
};
