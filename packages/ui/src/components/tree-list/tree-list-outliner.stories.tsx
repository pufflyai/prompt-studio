import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Eye, EyeOff, FileImage, Folder, Lock, LockOpen } from "lucide-react";
import { useRef, useState } from "react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { TreeList } from "./tree-list";
import type { TreeListNode } from "./tree-list.types";

const meta: Meta<typeof TreeList> = {
  title: "Components/Data Display/Tree List/Outliner",
  component: TreeList,
  parameters: {
    docs: {
      description: {
        component:
          "Compose authoring rows with controlled selection, expansion, order, extension previews, and persistent toggle actions. " +
          "Click replaces selection; Ctrl/Cmd toggles; Shift-click or Shift+Up/Down extends a visible enabled range. " +
          "Space/Enter selects. Alt+Up/Down emits the focused node's sibling move through onMoveNode. " +
          "The host decides which selected nodes move, persists order, and enforces domain rules such as locks. " +
          "Group expansion has its own control. Buttons do not select, activate, or drag their row. " +
          "Drop near a group edge for before/after, or in its center for inside. Native HTML drag moves and sortable customization remain separate APIs.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof TreeList>;

const Outliner = (props: { narrow?: boolean }) => {
  const { narrow } = props;
  const [selected, setSelected] = useState(["artwork"]);
  const [expanded, setExpanded] = useState(["group"]);
  const [hidden, setHidden] = useState<string[]>(["hidden"]);
  const [locked, setLocked] = useState<string[]>(["locked"]);
  const [order, setOrder] = useState(["title", "artwork", "group", "hidden", "locked", "disabled"]);
  const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  const node = (id: string, label: string): TreeListNode => ({
    id,
    label,
    disabled: id === "disabled",
    canDrag: !locked.includes(id) && id !== "disabled",
    canDrop: id !== "disabled",
    isContainer: id === "group",
    children: id === "group" ? [node("child", "Group child")] : undefined,
    startContent: (
      <HStack gap="2xs">
        <Box
          boxSize="5"
          display="grid"
          placeItems="center"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="xs"
        >
          {id === "group" ? <Folder size={14} /> : <FileImage size={14} />}
        </Box>
        {id === "artwork" ? (
          <Box aria-label="Mask preview" w="4" h="5" bg="fg" borderWidth="1px" borderColor="border.subtle" />
        ) : null}
      </HStack>
    ),
    indicator: hidden.includes(id) ? { icon: <EyeOff size={14} />, tooltip: "Hidden in the document" } : undefined,
    actionsVisibility: "always",
    actions: [
      {
        id: "visibility",
        label: `Toggle visibility: ${label}`,
        icon: hidden.includes(id) ? <EyeOff /> : <Eye />,
        pressed: !hidden.includes(id),
        disabled: id === "disabled",
        onAction: () => setHidden(toggle(hidden, id)),
      },
      {
        id: "lock",
        label: `Toggle lock: ${label}`,
        icon: locked.includes(id) ? <Lock /> : <LockOpen />,
        pressed: locked.includes(id),
        disabled: id === "disabled",
        onAction: () => setLocked(toggle(locked, id)),
      },
    ],
  });
  const labels: Record<string, string> = {
    title: "Title",
    artwork: "Artwork",
    group: "Group",
    hidden: "Hidden",
    locked: "Locked",
    disabled: "Unavailable",
  };
  return (
    <Stack w={narrow ? "64" : "80"} gap="xs">
      <TreeList
        sections={[{ id: "layers", nodes: order.map((id) => node(id, labels[id])) }]}
        activeNodeId={selected}
        expandedNodeIds={expanded}
        onSelectionChange={setSelected}
        onToggleNode={(id) => setExpanded(toggle(expanded, id))}
        onMoveNode={(source, target, position) => {
          if (!target || !order.includes(source) || !order.includes(target)) return;
          const next = order.filter((id) => id !== source);
          next.splice(next.indexOf(target) + (position === "after" ? 1 : 0), 0, source);
          setOrder(next);
        }}
      />
      <Text textStyle="label/XS" color="fg.muted" role="status">
        Selected: {selected.join(", ")}
      </Text>
    </Stack>
  );
};
export const ControlledAuthoringRows: Story = {
  render: () => <Outliner />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();
    const title = canvas.getByRole("option", { name: "Title", exact: true });
    const artwork = canvas.getByRole("option", { name: "Artwork", exact: true });
    await user.click(canvas.getByRole("button", { name: "Toggle visibility: Artwork" }));
    await waitFor(() => expect(artwork).toHaveAttribute("aria-selected", "true"));
    await expect(canvas.getByRole("button", { name: "Toggle visibility: Artwork" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(title);
    await user.keyboard("{Control>}");
    await user.click(artwork);
    await user.keyboard("{/Control}");
    await waitFor(() => expect(title).toHaveAttribute("aria-selected", "true"));
    await waitFor(() => expect(artwork).toHaveAttribute("aria-selected", "true"));
    await user.click(artwork);
    await waitFor(() => expect(title).toHaveAttribute("aria-selected", "false"));
    artwork.focus();
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await waitFor(() => expect(artwork).toHaveFocus());
    await waitFor(() => expect(artwork.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
    const group = canvas.getByRole("option", { name: "Group", exact: true });
    await user.click(group);
    await waitFor(() => expect(group).toHaveAttribute("aria-selected", "true"));
    await waitFor(() => expect(group).toHaveAttribute("aria-expanded", "true"));
    await user.click(canvas.getByRole("button", { name: "Collapse group" }));
    await waitFor(() => expect(group).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(group).toHaveAttribute("aria-selected", "true"));
  },
};
export const NarrowInspector: Story = { render: () => <Outliner narrow /> };

const VirtualSelection = () => {
  const scroll = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(["row-0"]);
  return (
    <Stack w="80" gap="xs">
      <Box ref={scroll} h="64" overflow="auto">
        <TreeList
          virtualize
          scrollRef={scroll}
          activeNodeId={selected}
          onSelectionChange={setSelected}
          sections={[
            {
              id: "virtual",
              nodes: Array.from({ length: 60 }, (_, index) => ({
                id: `row-${index}`,
                label: `Layer ${index}`,
                disabled: index > 5 && index < 45,
              })),
            },
          ]}
        />
      </Box>
      <Text role="status">Selected: {selected.join(", ")}</Text>
    </Stack>
  );
};
export const VirtualRangeSelection: Story = {
  render: () => <VirtualSelection />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();
    await user.click(canvas.getByRole("option", { name: "Layer 0", exact: true }));
    await user.keyboard("{Shift>}");
    for (let index = 0; index < 6; index += 1) await user.keyboard("{ArrowDown}");
    await user.keyboard("{/Shift}");
    await waitFor(() => expect(canvas.getByRole("option", { name: "Layer 45", exact: true })).toHaveFocus());
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("row-0, row-1, row-2, row-3, row-4, row-5, row-45"),
    );
  },
};

const Reparenting = () => {
  const [atRoot, setAtRoot] = useState(false);
  const [selected, setSelected] = useState(["b"]);
  const last = { id: "b", label: "Last layer" };
  return (
    <Stack w="80">
      <TreeList
        activeNodeId={selected}
        onSelectionChange={setSelected}
        expandedNodeIds={["g"]}
        sections={[
          {
            id: "layers",
            nodes: [
              {
                id: "g",
                label: "Group",
                isContainer: true,
                children: [{ id: "a", label: "First layer" }, ...(atRoot ? [] : [last])],
              },
              ...(atRoot ? [last] : []),
            ],
          },
        ]}
      />
      <Button onClick={() => setAtRoot(true)}>Move last layer to root</Button>
    </Stack>
  );
};
export const FocusAfterReparenting: Story = {
  render: () => <Reparenting />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("option", { name: "Last layer", exact: true }));
    // A host command changes hierarchy without moving focus to another control.
    fireEvent.click(canvas.getByRole("button", { name: "Move last layer to root" }));
    await waitFor(() =>
      expect(canvas.getByRole("option", { name: "Last layer", exact: true })).toHaveAttribute("aria-level", "1"),
    );
    await waitFor(() => expect(canvas.getByRole("option", { name: "Last layer", exact: true })).toHaveFocus());
  },
};
