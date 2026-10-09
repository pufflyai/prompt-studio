import { Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
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
} satisfies Meta<typeof InstantMoves>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DeferredPersistence: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const move = (after: boolean) => {
      const source = canvas.getByRole("option", { name: "Research" }).parentElement!;
      const target = canvas.getByRole("option", { name: "Meeting" }).parentElement!;
      const transfer = new DataTransfer();
      const y = after ? target.getBoundingClientRect().bottom - 1 : target.getBoundingClientRect().top + 1;
      for (const [type, element] of [
        ["dragstart", source],
        ["drop", target],
      ] as const)
        fireEvent(
          element,
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: y }),
        );
    };
    const after = () =>
      Boolean(
        canvas
          .getByRole("option", { name: "Meeting" })
          .compareDocumentPosition(canvas.getByRole("option", { name: "Research" })) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    await canvas.findByRole("option", { name: "Research" });
    move(true);
    await waitFor(() => expect(after()).toBe(true));
    await expect(canvas.getByTestId("saved-order")).toHaveTextContent("folder, first, second");
    await userEvent.click(canvas.getByRole("button", { name: "Reject save" }));
    await waitFor(() => expect(after()).toBe(false));
    await expect(canvas.getByText("Error: Save failed")).toBeVisible();
    move(true);
    await waitFor(() => expect(after()).toBe(true));
    move(false);
    await waitFor(() => expect(after()).toBe(false));
    await userEvent.click(canvas.getByRole("button", { name: "Finish save" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Finish save" })).toBeEnabled());
    await expect(after()).toBe(false);
    await userEvent.click(canvas.getByRole("button", { name: "Finish save" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Finish save" })).toBeDisabled());
    await expect(canvas.getByTestId("saved-order")).toHaveTextContent("folder, first, second");
    await expect(after()).toBe(false);
  },
};
