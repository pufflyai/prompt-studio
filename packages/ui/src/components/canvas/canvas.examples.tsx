import { Box, Button, Dialog, Flex, Input, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { useLayoutEffect, useRef, useState } from "react";
import { ScrollArea } from "../primitives/scroll-area";
import { Canvas } from "./canvas";
import type { CanvasCamera, CanvasPoint, CanvasZoomChange } from "./canvas.types";
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

export const FreeformCanvasExample = () => {
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const camera = useRef<CanvasCamera>({ x: 24, y: 24, zoom: 1 });
  const frame = useRef(0);
  const [ended, setEnded] = useState(0);
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
  };
  const zoom = (change: CanvasZoomChange) => {
    camera.current = zoomCanvas(camera.current, change, { minZoom: 0.1, maxZoom: 4 });
    paint();
  };
  const reset = () => {
    camera.current = { x: 24, y: 24, zoom: 1 };
    paint();
  };
  const fit = () => {
    const scale = Math.min((viewport.current!.clientWidth - 48) / 800, (viewport.current!.clientHeight - 48) / 380, 1);
    camera.current = { x: 24, y: 24, zoom: scale };
    paint();
  };
  useLayoutEffect(() => {
    const { x, y, zoom } = camera.current;
    stage.current!.style.transform = `translate(${x}px,${y}px) scale(${zoom})`;
    return () => cancelAnimationFrame(frame.current);
  }, []);
  return (
    <Flex direction="column" h="600px" minW="0">
      <Flex gap="xs" align="center" p="xs" wrap="wrap">
        <Button size="xs" onClick={() => zoom({ factor: 0.8, anchor: { x: 400, y: 250 } })}>
          Zoom out
        </Button>
        <Button size="xs" onClick={() => zoom({ factor: 1.25, anchor: { x: 400, y: 250 } })}>
          Zoom in
        </Button>
        <Button size="xs" onClick={fit}>
          Fit all
        </Button>
        <Button size="xs" onClick={reset}>
          Reset camera
        </Button>
        <Text textStyle="label/XS" role="status">
          Completed gestures: {ended}
        </Text>
      </Flex>
      <Canvas
        ref={viewport}
        flex="1"
        aria-label="Live designs canvas"
        onPan={pan}
        onZoom={zoom}
        onFit={fit}
        onReset={reset}
        onNavigationEnd={() => setEnded((value) => value + 1)}
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
    </Flex>
  );
};

export const ScrollCanvasExample = () => {
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
      <Flex gap="xs" p="xs" align="center">
        <Button size="xs" onClick={() => changeZoom({ factor: 0.8, anchor: { x: 400, y: 250 } })}>
          Zoom out
        </Button>
        <Button size="xs" onClick={() => changeZoom({ factor: 1.25, anchor: { x: 400, y: 250 } })}>
          Zoom in
        </Button>
        <Text textStyle="label/XS" role="status">
          {Math.round(zoom * 100)}%
        </Text>
      </Flex>
      <Canvas ref={viewport} flex="1" variant="pan" aria-label="Timeline canvas" onPan={pan} onZoom={changeZoom}>
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
  return (
    <Canvas aria-label="Flow canvas" onPan={() => {}} onZoom={() => {}} h="400px">
      <Stack gap="md" p="md" maxW="sm" data-canvas-control>
        <Input aria-label="Flow draft" placeholder="Normal-flow content" />
        <Button onClick={() => setClicked(true)}>{clicked ? "Clicked" : "Click me"}</Button>
      </Stack>
    </Canvas>
  );
};
