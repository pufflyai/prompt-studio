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

const RefreshSelectedNote = (props: { resourceFree?: boolean; aliases?: boolean }) => {
  const { resourceFree, aliases } = props;
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
  const [loaded, setLoaded] = useState(true);
  const [selected, setSelected] = useState("first");
  const [selectedNodeId, setSelectedNodeId] = useState("first");
  const trees = getWorkbenchRenderers(workbench);
  const state = useWorkbenchStore(trees.treeStore, (snapshot) => snapshot.statesByTreeId.notes);
  const page = { kind: "page", extensionId: "author.notes", id: "notes" } as const;
  const resource = (id: string) => ({ type: "note", id: aliases ? "shared" : id, extensionId: "author.notes" });
  const sections = [
    {
      id: "navigation",
      nodes: [
        {
          id: "notes",
          label: "Notes",
          collapsible: true,
          target: { kind: "page" as const, page },
          children: loaded
            ? ["first", "second"].map((id) => ({
                id,
                label: id,
                ...(resourceFree
                  ? { target: { kind: "page" as const, page: { ...page, id } } }
                  : { resource: resource(id) }),
              }))
            : [],
        },
      ],
    },
  ];
  const activeNodeId = useTreeSelection(workbench, "notes", {
    sections,
    childrenByNodeId: {},
    activeLocation: { page: resourceFree ? { ...page, id: selected } : page },
    activeResource: resourceFree ? undefined : resource(selected),
    selectedNodeId,
  });
  return (
    <Stack maxW="20rem">
      <Button onClick={() => setLoaded(false)}>Start refresh</Button>
      <Button onClick={() => setLoaded(true)}>Finish refresh</Button>
      <Button
        onClick={() => {
          setSelected("first");
          setSelectedNodeId("first");
        }}
      >
        Select first
      </Button>
      <Button
        onClick={() => {
          setSelected("second");
          setSelectedNodeId("second");
        }}
      >
        Select second
      </Button>
      <TreeList
        sections={sections}
        activeNodeId={activeNodeId}
        expandedNodeIds={state?.expandedNodeIds}
        expandedSectionIds={state?.expandedSectionIds}
        onToggleNode={(id) => trees.setNodeExpanded("notes", id, !state?.expandedNodeIds.includes(id))}
      />
    </Stack>
  );
};

const meta = {
  title: "pstdio-workbench/Guides/Tree selection reveal",
  tags: ["tree-selection-reveal"],
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

export const RefreshKeepsUserCollapse: StoryObj<typeof meta> = {
  render: () => <RefreshSelectedNote />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("option", { name: "first" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(canvas.getByRole("option", { name: "Notes" }));
    await userEvent.click(canvas.getByRole("button", { name: "Start refresh" }));
    await userEvent.click(canvas.getByRole("button", { name: "Finish refresh" }));
    await expect(canvas.getByRole("option", { name: "Notes" })).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(canvas.getByRole("button", { name: "Start refresh" }));
    await userEvent.click(canvas.getByRole("button", { name: "Select second" }));
    await userEvent.click(canvas.getByRole("button", { name: "Finish refresh" }));
    await expect(await canvas.findByRole("option", { name: "second" })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("option", { name: "Notes" })).toHaveAttribute("aria-expanded", "true");
  },
};

export const RefreshResourceFreePage: StoryObj<typeof meta> = {
  render: () => <RefreshSelectedNote resourceFree />,
  play: RefreshKeepsUserCollapse.play,
};

export const RevisitResourceAlias: StoryObj<typeof meta> = {
  render: () => <RefreshSelectedNote aliases />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("option", { name: "first" })).toHaveAttribute("aria-selected", "true");
    for (const name of ["second", "first"]) {
      await userEvent.click(canvas.getByRole("option", { name: "Notes" }));
      await userEvent.click(canvas.getByRole("button", { name: `Select ${name}` }));
      await expect(await canvas.findByRole("option", { name })).toHaveAttribute("aria-selected", "true");
    }
  },
};
