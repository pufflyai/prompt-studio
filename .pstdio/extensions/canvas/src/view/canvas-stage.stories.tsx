import { Box } from "@chakra-ui/react";
import { useState } from "react";
import { type CanvasDefinition, canvases } from "../canvases/definitions";
import { createCanvasRuntime } from "../controller/runtime";
import { readLayout } from "../layout";
import { CanvasStage } from "./canvas-stage";

const Example = (props: { canvas: CanvasDefinition; zoom?: number }) => {
  const { canvas, zoom = 1 } = props;
  const [runtime] = useState(() =>
    createCanvasRuntime(canvas, readLayout({ version: 1, camera: { x: 24, y: 24, zoom } }, canvas.items), () => {}),
  );
  return (
    <Box h="full" minH="0">
      <CanvasStage canvas={canvas} runtime={runtime} />
    </Box>
  );
};
export default { title: "Canvas/Workspace", parameters: { layout: "fullscreen" } };
export const Interactive = { render: () => <Example canvas={canvases[0]} /> };
export const ZoomedOut = { render: () => <Example canvas={canvases[0]} zoom={0.5} /> };
const populated: CanvasDefinition = {
  id: "populated-story",
  name: "Populated canvas",
  items: Array.from({ length: 24 }, (_, index) => ({
    ...canvases[0].items[index % 2],
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
  render: () => <Example canvas={canvases.find((canvas) => canvas.id === "documentation-contract")!} zoom={0.2} />,
};
