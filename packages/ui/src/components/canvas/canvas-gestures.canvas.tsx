import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Canvas } from "./canvas";
import { FreeformCanvasExample } from "./canvas.examples";

const meta: CanvasMeta<typeof Canvas> = {
  title: "Components/Layout/Canvas Gestures",
  component: Canvas,
  args: { zoom: 1, onPan: () => {}, onZoom: () => {}, onFit: () => {} },
};
export default meta;
type Story = CanvasFrame<typeof Canvas>;
const innerPan = () => {};
const innerZoom = () => {};
export const NestedCanvases: Story = {
  id: "components-layout-canvas-gestures--nested-canvases",
  render: (args) => (
    <Canvas {...args} h="600px" aria-label="Outer canvas">
      <Box p="lg" data-canvas-control>
        <Canvas h="300px" zoom={1} onPan={innerPan} onZoom={innerZoom} aria-label="Inner canvas" />
      </Box>
    </Canvas>
  ),
};
export const DiagonalPreviewScroll: Story = {
  id: "components-layout-canvas-gestures--diagonal-preview-scroll",
  render: (args) => <FreeformCanvasExample {...args} />,
};
export const PanAfterPinch: Story = {
  id: "components-layout-canvas-gestures--pan-after-pinch",
  render: (args) => (
    <Canvas {...args} h="400px" aria-label="Touch canvas">
      <Button onClick={args.onFit}>Touch action</Button>
    </Canvas>
  ),
};
export const InvalidControlledZoom: Story = {
  id: "components-layout-canvas-gestures--invalid-controlled-zoom",
  render: (args) => (
    <Stack>
      {[0, -1, Number.NaN, Number.POSITIVE_INFINITY].map((zoom, index) => (
        <Canvas key={index} {...args} h="32" zoom={zoom} aria-label={`Invalid zoom ${index}`} />
      ))}
    </Stack>
  ),
};
