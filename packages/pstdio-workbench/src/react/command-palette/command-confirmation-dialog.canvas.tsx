import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
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
} satisfies CanvasMeta<typeof CommandConfirmationDialog>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const DeleteSession: Story = {
  id: "pstdio-workbench-commands-confirmation--delete-session",
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
  id: "pstdio-workbench-commands-confirmation--archive-queued-session",
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
  id: "pstdio-workbench-commands-confirmation--retry-failure",
  args: {
    confirmation: {
      ...DeleteSession.args!.confirmation!,
      onConfirm: async () => {
        throw new Error("Could not save. Try again.");
      },
    },
  },
};
