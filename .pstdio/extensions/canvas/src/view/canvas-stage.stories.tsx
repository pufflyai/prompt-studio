import { Box } from "@chakra-ui/react";
import { useState } from "react";
import { type CanvasDefinition, canvases } from "../canvases/definitions";
import { documentationFixture, interactionFixture } from "../canvases/verification-fixtures";
import { createCanvasRuntime } from "../controller/runtime";
import { readLayout } from "../layout";
import { CanvasStage } from "./canvas-stage";

const Example = (props: { canvas: CanvasDefinition; zoom?: number; selected?: string }) => {
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
export default { title: "Canvas/Workspace", parameters: { layout: "fullscreen" } };
export const Interactive = { render: () => <Example canvas={interactionFixture} /> };
export const ZoomedOut = { render: () => <Example canvas={interactionFixture} zoom={0.5} /> };
export const SelectedFrame = { render: () => <Example canvas={interactionFixture} selected="project-form" /> };
const populated: CanvasDefinition = {
  id: "populated-story",
  name: "Populated canvas",
  items: Array.from({ length: 24 }, (_, index) => ({
    ...interactionFixture.items[index % 2],
    id: `preview-${index}`,
    name: `Interactive preview ${index + 1}`,
    position: { x: (index % 6) * 440, y: Math.floor(index / 6) * 500 },
  })),
};
export const Populated = { render: () => <Example canvas={populated} zoom={0.3} /> };
export const Foundations = {
  render: () => <Example canvas={canvases.find((canvas) => canvas.id === "foundations")!} zoom={0.4} />,
};
export const SharedComponents = {
  render: () => <Example canvas={canvases.find((canvas) => canvas.id === "shared-components")!} zoom={0.4} />,
};
export const IntrinsicDocumentation = {
  render: () => <Example canvas={documentationFixture} zoom={0.2} />,
};

export const GroupedFolderExamples = {
  render: () => <Example canvas={canvases.find((canvas) => canvas.name === "Create folder")!} zoom={0.2} />,
};
export const GroupedAutoBuild = {
  render: () => <Example canvas={canvases.find((canvas) => canvas.name === "Auto Build")!} zoom={0.2} />,
};
