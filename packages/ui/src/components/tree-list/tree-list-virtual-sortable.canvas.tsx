import { Box, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useRef, useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { TreeList } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";

const VirtualSortableTree = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lastOpened, setLastOpened] = useState("");
  const [sections, setSections] = useState<TreeListSection[]>([
    {
      id: "sessions",
      label: "Sessions",
      nodes: Array.from({ length: 1000 }, (_, index) => ({
        id: `session-${index + 1}`,
        label: `Session ${index + 1}`,
        isNavigable: true,
      })),
    },
  ]);
  return (
    <Stack w="80" gap="sm">
      <Text>Opened: {lastOpened}</Text>
      <ScrollArea height="96" viewportRef={scrollRef}>
        <TreeList
          virtualize
          draggable
          scrollRef={scrollRef}
          sections={sections}
          expandedSectionIds={["sessions"]}
          rowVariant="compact"
          onNavigate={(event) => setLastOpened(event.nodeId)}
          onReorderNodes={(sectionId, ids) =>
            setSections((current) =>
              current.map((section) =>
                section.id === sectionId
                  ? { ...section, nodes: ids.map((id) => section.nodes.find((node) => node.id === id)!) }
                  : section,
              ),
            )
          }
        />
      </ScrollArea>
    </Stack>
  );
};
const meta = {
  title: "Components/Data Display/Tree List/Virtual Sortable",
  component: VirtualSortableTree,
  tags: ["!manifest"],
} satisfies CanvasMeta<typeof VirtualSortableTree>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const LargeSessions: Story = {
  id: "components-data-display-tree-list-virtual-sortable--large-sessions",
};
export const ReorderVisibleRows: Story = {
  id: "components-data-display-tree-list-virtual-sortable--reorder-visible-rows",
};
const VirtualSections = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [ids, setIds] = useState(["Files", "Sessions"]);
  return (
    <Box w="80">
      <ScrollArea height="64" viewportRef={scrollRef}>
        <TreeList
          virtualize
          draggable
          scrollRef={scrollRef}
          sections={ids.map((id) => ({ id, label: id, nodes: [{ id: `${id}-row`, label: `${id} row` }] }))}
          expandedSectionIds={ids}
          onReorderSections={setIds}
        />
      </ScrollArea>
    </Box>
  );
};
export const ReorderSections: Story = {
  id: "components-data-display-tree-list-virtual-sortable--reorder-sections",
  render: () => <VirtualSections />,
};
const VirtualGroups = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [orders, setOrders] = useState<Record<string, string[]>>({ navigation: ["search"], research: [] });
  return (
    <Box w="80">
      <ScrollArea height="64" viewportRef={scrollRef}>
        <TreeList
          virtualize
          draggable
          scrollRef={scrollRef}
          sections={[
            { id: "navigation", nodes: orders.navigation.map((id) => ({ id, label: "Search" })) },
            { id: "research", label: "Research", nodes: orders.research.map((id) => ({ id, label: "Search" })) },
          ]}
          expandedSectionIds={["research"]}
          onReorderNodes={(sectionId, ids) => setOrders((current) => ({ ...current, [sectionId]: ids }))}
        />
      </ScrollArea>
    </Box>
  );
};
export const MoveIntoGroup: Story = {
  id: "components-data-display-tree-list-virtual-sortable--move-into-group",
  render: () => <VirtualGroups />,
};
