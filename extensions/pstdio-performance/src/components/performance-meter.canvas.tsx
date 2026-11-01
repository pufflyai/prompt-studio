import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { PerformanceMeter } from "./performance-meter";
import {
  backendSnapshot,
  browserSnapshot,
  reconnectingSnapshot,
  smoothSnapshot,
  underLoadSnapshot,
} from "./performance-snapshot.fixtures";

const meta = {
  title: "Extensions/Performance/Status meter",
  component: PerformanceMeter,
  args: { snapshot: backendSnapshot },
  decorators: [
    (Story) => (
      <Box layerStyle="statusBarItem" h="6" bg="bg.subtle" display="inline-flex">
        <Story />
      </Box>
    ),
  ],
} satisfies CanvasMeta<typeof PerformanceMeter>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Backend: Story = { id: "extensions-performance-meter--backend" };
export const Reconnecting: Story = {
  id: "extensions-performance-meter--reconnecting",
  args: { snapshot: reconnectingSnapshot },
};
export const FrameRateOnly: Story = {
  id: "extensions-performance-meter--frame-rate-only",
  args: { snapshot: smoothSnapshot },
};
export const SustainedCpu: Story = {
  id: "extensions-performance-meter--sustained-cpu",
  args: { snapshot: underLoadSnapshot },
};
export const BrowserTab: Story = {
  id: "extensions-performance-meter--browser-tab",
  args: { snapshot: browserSnapshot },
};
