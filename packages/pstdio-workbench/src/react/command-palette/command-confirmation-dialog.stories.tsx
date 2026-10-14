import type { Meta, StoryObj } from "@storybook/react";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { CommandConfirmationDialog } from "./palette-params-dialog";

const meta = {
  title: "pstdio-workbench/Commands/Confirmation",
  component: CommandConfirmationDialog,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof CommandConfirmationDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DeleteSession: Story = {
  args: {
    confirmation: {
      label: "Delete session “Landing page”",
      description: "This cannot be undone. Workspace files and external agent history are kept.",
      buttonLabel: "Delete",
      resolve: () => undefined,
      onConfirm: async () => undefined,
    },
  },
};
export const ArchiveQueuedSession: Story = {
  args: {
    confirmation: {
      label: "Archive session “Landing page”",
      description: "The saved conversation is kept. Queued work will be cancelled.",
      buttonLabel: "Archive",
      resolve: () => undefined,
      onConfirm: async () => undefined,
    },
  },
};
export const RetryFailure: Story = {
  args: {
    confirmation: {
      ...DeleteSession.args!.confirmation,
      onConfirm: async () => {
        throw new Error("Could not save. Try again.");
      },
    },
  },
};
