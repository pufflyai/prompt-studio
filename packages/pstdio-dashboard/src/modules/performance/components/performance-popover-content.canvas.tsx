import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { PerformancePopoverContent } from "./performance-popover-content";
import {
  browserSnapshot,
  collectingSnapshot,
  extensionNames,
  loadFrameRate,
  manyExtensionsSnapshot,
  smoothFrameRate,
  smoothSnapshot,
  underLoadSnapshot,
} from "./performance-snapshot.fixtures";

const meta = {
  title: "Settings/Developer tools/Performance popover",
  component: PerformancePopoverContent,
  args: {
    buckets: smoothFrameRate,
    paused: new Set<string>(),
    openViews: new Map<string, number>(),
    extensionName: (id: string) => extensionNames[id] ?? "Unknown extension",
    onPause: () => undefined,
    onResume: () => undefined,
  },
  decorators: [
    (Story) => (
      <Box width="performance-popover" borderWidth="1px" borderColor="border" bg="bg" paddingX="md" paddingY="sm">
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
  args: { snapshot: underLoadSnapshot, buckets: loadFrameRate },
};
export const ExtensionPaused: Story = {
  id: "settings-developer-tools-performance-popover--extension-paused",
  args: { snapshot: smoothSnapshot, paused: new Set(["shader"]) },
};
export const ManyExtensions: Story = {
  id: "settings-developer-tools-performance-popover--many-extensions",
  args: { snapshot: manyExtensionsSnapshot },
};
export const AllExtensions: Story = {
  id: "settings-developer-tools-performance-popover--all-extensions",
  args: { snapshot: manyExtensionsSnapshot },
};
const openViews = new Map([
  ["notes", 1],
  ["shader", 1],
]);
export const Collecting: Story = {
  id: "settings-developer-tools-performance-popover--collecting",
  args: { snapshot: collectingSnapshot, buckets: [], openViews },
};
export const CpuUnavailable: Story = {
  id: "settings-developer-tools-performance-popover--cpu-unavailable",
  args: { snapshot: undefined, error: "Rejected desktop IPC from an untrusted sender", openViews },
};
export const BrowserTab: Story = {
  id: "settings-developer-tools-performance-popover--browser-tab",
  args: { snapshot: browserSnapshot, openViews },
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
