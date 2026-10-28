import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import type { Diff } from "./diff-drawer";
import { DiffDrawer } from "./lazy-diff";

type StoryFn = () => ReactNode;

const waitForDiff = () => new Promise<void>(() => undefined);

const loadingDiffs: Diff[] = [
  {
    change: "modified",
    oldPath: "src/lazy-file.ts",
    newPath: "src/lazy-file.ts",
    additions: 4,
    deletions: 2,
  },
];

const meta: Meta<typeof DiffDrawer> = {
  title: "Patterns/Diff/Diff Panel/Loading",
  component: DiffDrawer,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story: StoryFn) => (
      <Box height="100vh" width="100vw" border="1px solid" borderColor="border.subtle" overflow="hidden">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DiffDrawer>;

export const DeferredContent: Story = {
  render: (args) => <DiffDrawer {...args} />,
  args: {
    diffs: loadingDiffs,
    onLoadDiff: waitForDiff,
  },
};
