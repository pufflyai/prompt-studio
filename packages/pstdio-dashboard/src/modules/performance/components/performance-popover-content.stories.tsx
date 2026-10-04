import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
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
} satisfies Meta<typeof PerformancePopoverContent>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Smooth: Story = { args: { snapshot: smoothSnapshot } };
export const UnderLoad: Story = { args: { snapshot: underLoadSnapshot, buckets: loadFrameRate } };
export const ExtensionPaused: Story = {
  args: { snapshot: smoothSnapshot, paused: new Set(["shader"]) },
};
export const ManyExtensions: Story = { args: { snapshot: manyExtensionsSnapshot } };
export const AllExtensions: Story = {
  args: { snapshot: manyExtensionsSnapshot },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("performance-more-extensions"));
    await expect(canvas.getAllByTestId("performance-cpu-row")).toHaveLength(13);
  },
};
const openViews = new Map([
  ["notes", 1],
  ["shader", 1],
]);
export const Collecting: Story = { args: { snapshot: collectingSnapshot, buckets: [], openViews } };
export const CpuUnavailable: Story = {
  args: { snapshot: undefined, error: "Rejected desktop IPC from an untrusted sender", openViews },
};
export const BrowserTab: Story = { args: { snapshot: browserSnapshot, openViews } };

// A helper process, such as the GPU, can raise the warning too.
export const GpuBusy: Story = {
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
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/^GPU averaged 92% CPU/)).toBeVisible();
  },
};
