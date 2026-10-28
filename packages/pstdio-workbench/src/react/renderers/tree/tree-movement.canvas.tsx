import { Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench, type TreeViewSection } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { previewTreeMove } from "./tree-move-preview";
import { WorkbenchTreeView } from "./tree-view";

const createFixture = (changed: () => void) => {
  const workbench = createWorkbench();
  let saved: TreeViewSection[] = [
    {
      id: "notes",
      nodes: [
        {
          id: "notes",
          label: "Notes",
          canDrop: true,
          children: [
            { id: "folder", label: "Ideas", canDrop: true, children: [] },
            { id: "first", label: "Research", canDrag: true, canDrop: true },
            { id: "second", label: "Meeting", canDrag: true, canDrop: true },
          ],
        },
      ],
    },
  ];
  const pending: ((success: boolean) => void)[] = [];
  workbench.views.registerView({
    id: "notes",
    title: "Notes",
    body: {
      kind: "tree",
      defaultExpandedNodeIds: ["notes", "folder"],
      getBody: () => saved,
      getChildren: (node) => node.children ?? [],
      moveNode: (source, target, ctx) =>
        new Promise<void>((resolve, reject) => {
          pending.push((success) => {
            if (success && target) {
              saved = previewTreeMove(
                saved,
                {},
                { sourceId: source.id, targetId: target.id, position: ctx.position ?? "inside" },
              );
              resolve();
            } else reject(new Error("Save failed"));
            changed();
          });
          changed();
        }),
    },
  });
  return { workbench, pending, savedOrder: () => saved[0].nodes[0].children!.map((node) => node.id).join(", ") };
};
const InstantMoves = () => {
  const [, setRevision] = useState(0);
  const [fixture] = useState(() => createFixture(() => setRevision((current) => current + 1)));
  const [error, setError] = useState("");
  return (
    <Stack maxW="24rem">
      <Text>Rows move immediately. Finish or reject the deferred save to see reconciliation.</Text>
      <WorkbenchTreeView
        workbench={fixture.workbench}
        treeViewId="notes"
        onOpenResourceError={(reason) => setError(String(reason))}
      />
      <Text data-testid="saved-order">{fixture.savedOrder()}</Text>
      <Text>{error}</Text>
      <Button disabled={!fixture.pending.length} onClick={() => fixture.pending.shift()?.(true)}>
        Finish save
      </Button>
      <Button disabled={!fixture.pending.length} onClick={() => fixture.pending.shift()?.(false)}>
        Reject save
      </Button>
    </Stack>
  );
};
const meta = {
  title: "pstdio-workbench/Tree/Instant resource moves",
  component: InstantMoves,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta<typeof InstantMoves>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const DeferredPersistence: Story = {
  id: "pstdio-workbench-tree-instant-resource-moves--deferred-persistence",
};
