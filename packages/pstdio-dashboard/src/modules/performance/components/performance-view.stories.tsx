import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { browserSnapshot, desktopSnapshot, extensionNames } from "./performance-snapshot.fixtures";
import { PerformanceViewContent } from "./performance-view";

const meta = {
  title: "Settings/Developer tools/Performance view",
  component: PerformanceViewContent,
  args: {
    extensionName: (id: string) => extensionNames[id] ?? "Unknown extension",
  },
  decorators: [
    (Story) => (
      <Box width="420px" borderWidth="1px" borderColor="border.subtle">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof PerformanceViewContent>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { args: { snapshot: desktopSnapshot } };
export const CollectingFirstSample: Story = {
  args: { snapshot: { ...desktopSnapshot, measurementWindowMs: null, processes: [], frames: [] } },
};
export const BrowserOnly: Story = { args: { snapshot: browserSnapshot } };
export const LongTasksOnly: Story = {
  args: {
    snapshot: {
      ...browserSnapshot,
      capabilities: { ...browserSnapshot.capabilities, slowFrames: "longtask" },
      frames: [{ ...browserSnapshot.frames[0]!, blockingDurationMs: null, scripts: [] }],
    },
  },
};
export const Loading: Story = { args: { snapshot: undefined } };
export const LoadFailure: Story = { args: { error: "Rejected desktop IPC from an untrusted sender" } };
