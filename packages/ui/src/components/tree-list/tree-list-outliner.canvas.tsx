import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { Eye, EyeOff, FileImage, Folder, Lock, LockOpen } from "lucide-react";
import { useRef, useState } from "react";
import { ScrollArea } from "../primitives/scroll-area";
import { TreeList } from "./tree-list";
import type { TreeListNode } from "./tree-list.types";

const meta: CanvasMeta<typeof TreeList> = {
  title: "Components/Data Display/Tree List/Outliner",
  component: TreeList,
  description:
    "Compose authoring rows with controlled selection, expansion, order, extension previews, and persistent toggle actions. " +
    "Click replaces selection; Ctrl/Cmd toggles; Shift-click or Shift+Up/Down extends a visible enabled range. " +
    "Space/Enter selects. Alt+Up/Down emits the focused node's sibling move through onMoveNode. " +
    "Moves apply to the source by default; set moveSelection when the host moves the selected set. The host persists order and enforces domain rules such as locks. " +
    "Group expansion has its own control. Buttons do not select, activate, or drag their row. " +
    "Drop near a group edge for before/after, or in its center for inside. Native HTML drag moves and sortable customization remain separate APIs.",
};
export default meta;
type Story = CanvasVariant<typeof TreeList>;
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
          if (position === "inside" || !target || !order.includes(source) || !order.includes(target)) return;
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
  id: "components-data-display-tree-list-outliner--controlled-authoring-rows",
  description: "This example reorders root siblings. Drops inside groups are ignored.",
  render: () => <Outliner />,
};
export const NarrowInspector: Story = {
  id: "components-data-display-tree-list-outliner--narrow-inspector",
  render: () => <Outliner narrow />,
};
const VirtualSelection = () => {
  const scroll = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(["row-0"]);
  return (
    <Stack w="80" gap="xs">
      <ScrollArea viewportRef={scroll} h="64">
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
      </ScrollArea>
      <Text role="status">Selected: {selected.join(", ")}</Text>
    </Stack>
  );
};
export const VirtualRangeSelection: Story = {
  id: "components-data-display-tree-list-outliner--virtual-range-selection",
  render: () => <VirtualSelection />,
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
  id: "components-data-display-tree-list-outliner--focus-after-reparenting",
  render: () => <Reparenting />,
};
