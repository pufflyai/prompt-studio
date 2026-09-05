import { Box, chakra, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import type { WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { createKilnScene } from "./kiln-scene";

export const KilnViewport = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof createKilnScene> | null>(null);
  const [grid, setGrid] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  useEffect(() => {
    if (!canvas.current) return;
    const editor = createKilnScene(canvas.current, input.workbench);
    scene.current = editor;
    return () => {
      editor.dispose();
      scene.current = null;
    };
  }, [input.workbench]);
  useEffect(() => scene.current?.setGrid(grid), [grid]);
  useEffect(() => scene.current?.setWireframe(wireframe), [wireframe]);

  return (
    <Stack h="full" overflow="hidden" gap="0" bg="bg.subtle">
      <HStack h="10" flexShrink={0} px="md" justify="space-between" borderBottomWidth="1px" borderColor="border.subtle">
        <HStack gap="xs" color="fg.muted">
          <WorkbenchIcon name="Orbit" size={14} />
          <Text textStyle="paragraph/XS/medium">Perspective</Text>
        </HStack>
        <HStack gap="2xs">
          <IconButton
            aria-label="Toggle viewport grid"
            aria-pressed={grid}
            size="xs"
            variant={grid ? "subtle" : "ghost"}
            onClick={() => setGrid(!grid)}
          >
            <WorkbenchIcon name="Grid3X3" />
          </IconButton>
          <IconButton
            aria-label="Toggle wireframe"
            aria-pressed={wireframe}
            size="xs"
            variant={wireframe ? "subtle" : "ghost"}
            onClick={() => setWireframe(!wireframe)}
          >
            <WorkbenchIcon name="Box" />
          </IconButton>
          <Box h="4" mx="xs" borderLeftWidth="1px" borderColor="border.subtle" />
          <IconButton aria-label="Reset view" size="xs" variant="ghost" onClick={() => scene.current?.resetView()}>
            <WorkbenchIcon name="Scan" />
          </IconButton>
        </HStack>
      </HStack>
      <Box position="relative" flex="1" minH="0">
        <chakra.canvas
          ref={canvas}
          display="block"
          w="full"
          h="full"
          tabIndex={0}
          aria-label="3D scene. Drag to orbit, scroll to zoom. Select objects here or in the scene collection."
        />
      </Box>
    </Stack>
  );
};
