import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useRef, useState } from "react";

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
} satisfies CanvasMeta<typeof PendingTreeRename>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const PendingSave: Story = {
  id: "research--pending-save",
};
