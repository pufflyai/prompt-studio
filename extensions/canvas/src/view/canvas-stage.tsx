import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { ResizableSplitLayout, resolveIconComponent, Tooltip } from "@pstdio/ui";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CanvasDefinition } from "../canvas-model";
import { Button } from "../components/themed-primitives";
import { installItemMovement } from "../controller/item-movement";
import type { CanvasRuntime } from "../controller/runtime";
import {
  FrameAnimationOutlet,
  FrameEditorMenu,
  FrameEditorOutlet,
  FrameEditorVisible,
} from "../parameters/editor-outlet";
import { CanvasViewport } from "./canvas-viewport";
import { ItemFrame } from "./item-frame";

const ParametersIcon = resolveIconComponent("sliders-horizontal")!;
const AnimationIcon = resolveIconComponent("film")!;
interface StageProps {
  canvas: CanvasDefinition;
  runtime: CanvasRuntime;
}
export const CanvasStage = (props: StageProps) => {
  const { canvas, runtime } = props;
  const selected = useSyncExternalStore(runtime.selection.subscribe, runtime.selection.get);
  const selectedEditable = useSyncExternalStore(runtime.editable.subscribe, () =>
    selected === undefined ? false : runtime.editable.get(selected),
  );
  const [editorOpen, setEditorOpen] = useState(true);
  const [animationOpen, setAnimationOpen] = useState(true);
  const [animatedFrame, setAnimatedFrame] = useState<string>();
  const [intrinsicHeight, setIntrinsicHeight] = useState(184);
  const [resizedHeight, setResizedHeight] = useState<number>();
  const [animationOutlet, setAnimationOutlet] = useState<HTMLDivElement | null>(null);
  const [outlet, setOutlet] = useState<HTMLDivElement | null>(null);
  const editorToggle = useRef<HTMLButtonElement>(null);
  const animationToggle = useRef<HTMLButtonElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const hasAnimation = selected !== undefined && animatedFrame === selected;
  const showEditor = selectedEditable && editorOpen;
  const showAnimation = hasAnimation && animationOpen;
  useLayoutEffect(() => {
    const container = shell.current!;
    // The camera owns navigation; native focus and scrollIntoView must not move its viewport.
    const overflow = container.style.overflow;
    container.style.overflow = "clip";
    runtime.mount(container, stage.current!);
    let active = true;
    let measureFrame = 0;
    const measure = () => {
      if (!active) return;
      cancelAnimationFrame(measureFrame);
      measureFrame = requestAnimationFrame(() => runtime.measure());
    };
    const observer = new ResizeObserver(measure);
    for (const element of runtime.elements()) observer.observe(element);
    observer.observe(container);
    runtime.measure();
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    const cleanup = installItemMovement(container, runtime);
    return () => {
      active = false;
      cleanup();
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
      cancelAnimationFrame(measureFrame);
      container.style.overflow = overflow;
      runtime.dispose();
    };
  }, [runtime]);
  return (
    <FrameEditorOutlet value={outlet}>
      <FrameEditorVisible value={showEditor}>
        <FrameAnimationOutlet
          value={{
            element: animationOutlet,
            open: showAnimation,
            setActiveFrame: setAnimatedFrame,
            reportHeight: setIntrinsicHeight,
            heightLimit: resizedHeight,
          }}
        >
          <ResizableSplitLayout
            resizableSide="bottom"
            separator="line"
            resizeLabel="Resize animation timeline"
            defaultSizePx={resizedHeight ?? intrinsicHeight}
            minSizePx={128}
            contentMinSizePx={200}
            collapsed={!showAnimation}
            onSizeChange={setResizedHeight}
            onCollapsedChange={(collapsed) => {
              setAnimationOpen(!collapsed);
              if (collapsed) requestAnimationFrame(() => animationToggle.current?.focus());
            }}
            resizablePanel={<Box ref={setAnimationOutlet} minH="0" data-animation-tray />}
            contentPanel={
              <ResizableSplitLayout
                resizableSide="right"
                separator="line"
                resizeLabel="Resize frame editor"
                defaultSizePx={320}
                minSizePx={160}
                contentMinSizePx={200}
                collapsed={!showEditor}
                onCollapsedChange={(collapsed) => {
                  setEditorOpen(!collapsed);
                  if (collapsed) requestAnimationFrame(() => editorToggle.current?.focus());
                }}
                resizablePanel={<FrameEditorMenu outlet={setOutlet} open={showEditor} />}
                contentPanel={
                  <Box flex="1" minW="0" position="relative">
                    <CanvasViewport viewportRef={shell} name={canvas.name} runtime={runtime}>
                      <Text id="canvas-instructions" srOnly>
                        Select a frame before interacting. Click empty space or press Escape on the canvas to clear
                        selection. Drag empty space to pan. Drag panel dividers towards their edge to close them; focus
                        a divider and press Home to close it with the keyboard. Use the move handle to move a preview.
                        Focus the canvas for arrow keys, plus and minus, F to fit, and 0 to reset the camera.
                      </Text>
                      <Box ref={stage} position="absolute" top="0" left="0" transformOrigin="0 0" data-canvas-stage>
                        {canvas.items.map((item) => (
                          <ItemFrame key={item.id} item={item} runtime={runtime} />
                        ))}
                      </Box>
                    </CanvasViewport>
                    {selected !== undefined && (
                      <Flex position="absolute" top="sm" right="sm" gap="2xs" data-canvas-control>
                        {hasAnimation && !animationOpen && (
                          <Tooltip content="Open animation timeline">
                            <Button
                              ref={animationToggle}
                              size="xs"
                              variant="ghost"
                              aria-label="Open animation timeline"
                              onClick={() => setAnimationOpen(true)}
                            >
                              <Icon as={AnimationIcon} boxSize="icon-sm" />
                            </Button>
                          </Tooltip>
                        )}
                        {selectedEditable && !editorOpen && (
                          <Tooltip content="Open frame parameters">
                            <Button
                              ref={editorToggle}
                              size="xs"
                              variant="ghost"
                              aria-label="Open frame parameters"
                              onClick={() => setEditorOpen(true)}
                            >
                              <Icon as={ParametersIcon} boxSize="icon-sm" />
                            </Button>
                          </Tooltip>
                        )}
                      </Flex>
                    )}
                  </Box>
                }
              />
            }
          />
        </FrameAnimationOutlet>
      </FrameEditorVisible>
    </FrameEditorOutlet>
  );
};
