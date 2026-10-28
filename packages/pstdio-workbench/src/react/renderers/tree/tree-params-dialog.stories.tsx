import { Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useRef, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench } from "../../../core";
import { WorkbenchActionErrors } from "../../notifications/action-errors";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import type { TreeActionParamsRequest } from "./tree-actions";
import { TreeParamsDialog } from "./tree-params-dialog";

const PendingTreeRename = () => {
  const [workbench] = useState(() => createWorkbench());
  const pending = useRef<(error: Error) => void>(undefined);
  const [request, setRequest] = useState<TreeActionParamsRequest | null>(null);
  return (
    <WorkbenchThemeProvider>
      <Stack>
        <Button
          onClick={() =>
            setRequest({
              request: {
                record: {
                  command: {
                    id: "rename-note",
                    label: "Rename note",
                    params: { title: { type: "text", label: "Title", required: true } },
                    resourceMutation: { kind: "rename", resourceType: "note", idParam: "noteId", labelParam: "title" },
                  },
                },
                label: "Rename note",
                args: { noteId: "note", title: "Research" },
              },
              run: () =>
                new Promise((_, reject) => {
                  pending.current = reject;
                }),
            })
          }
        >
          Rename note
        </Button>
        <Button onClick={() => pending.current?.(new Error("Save failed"))}>Fail save</Button>
        <WorkbenchActionErrors workbench={workbench} target="region:main" />
        <TreeParamsDialog
          request={request}
          workbench={workbench}
          onClose={() => setRequest((current) => (current === request ? null : current))}
        />
      </Stack>
    </WorkbenchThemeProvider>
  );
};
const meta = {
  title: "pstdio-workbench/Guides/Tree rename parameters",
  component: PendingTreeRename,
} satisfies Meta<typeof PendingTreeRename>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PendingSave: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Rename note" }));
    const dialog = await body.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Run" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "Fail save" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Save failed");
  },
};
