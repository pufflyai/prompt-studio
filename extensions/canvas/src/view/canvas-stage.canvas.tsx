import { Box } from "@chakra-ui/react";
import { useState } from "react";
import type { CanvasDefinition } from "../canvas-model";
import { createCanvasRuntime } from "../controller/runtime";
import { readLayout } from "../layout";
import { documentationFixture, interactionFixture, populatedFixture } from "./canvas-fixtures";
import { CanvasStage } from "./canvas-stage";

interface ExampleProps {
  canvas: CanvasDefinition;
  zoom?: number;
  selected?: string;
}
const Example = (props: ExampleProps) => {
  const { canvas, zoom = 1, selected } = props;
  const [runtime] = useState(() => {
    const runtime = createCanvasRuntime(
      canvas,
      readLayout({ version: 1, camera: { x: 24, y: 24, zoom } }, canvas.items),
      () => {},
    );
    runtime.select(selected);
    return runtime;
  });
  return (
    <Box w="full" h="full" minH="0">
      <CanvasStage canvas={canvas} runtime={runtime} />
    </Box>
  );
};
export default { title: "Canvas/Workspace", fullscreen: true };
export const Interactive = () => <Example canvas={interactionFixture} />;
export const ZoomedOut = () => <Example canvas={interactionFixture} zoom={0.5} />;
export const SelectedFrame = () => <Example canvas={interactionFixture} selected="project-form" />;
export const Populated = () => <Example canvas={populatedFixture} zoom={0.3} />;
export const IntrinsicDocumentation = () => <Example canvas={documentationFixture} zoom={0.2} />;
