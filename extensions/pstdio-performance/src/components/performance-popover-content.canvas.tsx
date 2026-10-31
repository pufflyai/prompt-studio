import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { PerformancePopoverContent } from "./performance-popover-content";
import {
  backendSnapshot,
  browserSnapshot,
  collectingSnapshot,
  loadFrameRate,
  manyExtensionsSnapshot,
  reconnectingSnapshot,
  restartedSnapshot,
  sharedProcessSnapshot,
  smoothSnapshot,
  underLoadSnapshot,
} from "./performance-snapshot.fixtures";

const meta = {
  title: "Extensions/Performance/Popover",
  component: PerformancePopoverContent,
  args: {
    onCopy: () => undefined,
    onDismissActionError: () => undefined,
    onPause: () => undefined,
    onResume: () => undefined,
  },
  decorators: [
    (Story) => (
      <Box width="performance-popover" borderWidth="1px" borderColor="border" bg="bg">
        <Story />
      </Box>
    ),
  ],
} satisfies CanvasMeta<typeof PerformancePopoverContent>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Smooth: Story = {
  id: "settings-developer-tools-performance-popover--smooth",
  args: { snapshot: smoothSnapshot },
};
export const UnderLoad: Story = {
  id: "settings-developer-tools-performance-popover--under-load",
  args: { snapshot: { ...underLoadSnapshot, frameRate: loadFrameRate } },
};
export const ExtensionPaused: Story = {
  id: "settings-developer-tools-performance-popover--extension-paused",
  args: { snapshot: { ...smoothSnapshot, pausedExtensionIds: ["installed-motion"] } },
};
export const ManyExtensions: Story = {
  id: "settings-developer-tools-performance-popover--many-extensions",
  args: { snapshot: manyExtensionsSnapshot },
};
export const AllExtensions: Story = {
  id: "settings-developer-tools-performance-popover--all-extensions",
  args: { snapshot: manyExtensionsSnapshot },
};
export const Collecting: Story = {
  id: "settings-developer-tools-performance-popover--collecting",
  args: { snapshot: collectingSnapshot },
};
export const CpuUnavailable: Story = {
  id: "settings-developer-tools-performance-popover--cpu-unavailable",
  args: { snapshot: undefined, error: "Rejected desktop IPC from an untrusted sender" },
};
export const BrowserTab: Story = {
  id: "settings-developer-tools-performance-popover--browser-tab",
  args: { snapshot: browserSnapshot },
};
// A helper process, such as the GPU, can raise the warning too.
export const GpuBusy: Story = {
  id: "settings-developer-tools-performance-popover--gpu-busy",
  args: {
    snapshot: {
      ...smoothSnapshot,
      processes: smoothSnapshot.processes.map((process) =>
        process.role === "gpu"
          ? { ...process, cpuPercent: 92, averageCpuPercent: 92, sustainedHighCpu: true }
          : process,
      ),
    },
  },
};
export const Backend: Story = {
  id: "extensions-performance-popover--backend",
  args: { snapshot: backendSnapshot },
};
export const BackendReconnecting: Story = {
  id: "extensions-performance-popover--backend-reconnecting",
  args: { snapshot: reconnectingSnapshot },
};
export const BackendRestarted: Story = {
  id: "extensions-performance-popover--backend-restarted",
  args: { snapshot: restartedSnapshot },
};
export const Copied: Story = {
  id: "extensions-performance-popover--copied",
  args: { snapshot: backendSnapshot, copied: true },
};
export const SharedProcess: Story = {
  id: "extensions-performance-popover--shared-process",
  args: { snapshot: sharedProcessSnapshot },
};
export const ActionFailed: Story = {
  id: "extensions-performance-popover--action-failed",
  args: { snapshot: smoothSnapshot, actionError: "Performance controls require a local user interaction" },
};
