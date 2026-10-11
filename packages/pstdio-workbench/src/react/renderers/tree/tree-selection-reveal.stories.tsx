import { Button, Stack } from "@chakra-ui/react";
import { TreeList } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { useTreeSelection } from "./use-tree-selection";

const RevealNewNote = () => {
  const [workbench] = useState(() => {
    const instance = createWorkbench();
    getWorkbenchRenderers(instance).registerTreeRenderer({
      id: "notes",
      title: "Notes",
      getBody: () => [],
      getChildren: () => [],
    });
    return instance;
  });
  const [created, setCreated] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const trees = getWorkbenchRenderers(workbench);
  const state = useWorkbenchStore(trees.treeStore, (snapshot) => snapshot.statesByTreeId.notes);
  const sections = [
    {
      id: "navigation",
      nodes: [
        {
          id: "notes",
          label: "Notes",
          children: [{ id: "ideas", label: "Ideas", children: created ? [{ id: "new-note", label: "New note" }] : [] }],
        },
      ],
    },
  ];
  const activeNodeId = useTreeSelection(workbench, "notes", {
    sections,
    childrenByNodeId: {},
    activeNodeId: created ? "new-note" : undefined,
  });
  return (
    <Stack maxW="20rem" key={refresh}>
      <Button onClick={() => setCreated(true)}>New note in Ideas</Button>
      <Button onClick={() => setRefresh((value) => value + 1)}>Refresh</Button>
      <TreeList
        sections={sections}
        expandedNodeIds={state?.expandedNodeIds}
        expandedSectionIds={state?.expandedSectionIds}
        activeNodeId={activeNodeId}
        onToggleNode={(id) => trees.setNodeExpanded("notes", id, !state?.expandedNodeIds.includes(id))}
      />
    </Stack>
  );
};

const meta = {
  title: "pstdio-workbench/Guides/Tree selection reveal",
  component: RevealNewNote,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof RevealNewNote>;
export default meta;
export const NewNoteInCollapsedFolder: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("option", { name: "New note" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "New note in Ideas" }));
    await expect(await canvas.findByRole("option", { name: "New note" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(canvas.getByRole("option", { name: "Ideas" }));
    await userEvent.click(canvas.getByRole("button", { name: "Refresh" }));
    await expect(canvas.queryByRole("option", { name: "New note" })).not.toBeInTheDocument();
  },
};
