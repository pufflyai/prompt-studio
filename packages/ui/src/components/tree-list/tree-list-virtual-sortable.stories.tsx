import { Box, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useRef, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
} satisfies Meta<typeof VirtualSortableTree>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LargeSessions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = await canvas.findByRole("option", { name: "Session 1" });
    await expect(first).toBeVisible();
    await expect(canvas.getAllByRole("option").length).toBeLessThan(60);
    await userEvent.click(first);
    await expect(canvas.getByText("Opened: session-1")).toBeVisible();
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(canvas.getByRole("option", { name: "Session 1000" })).toHaveFocus());
    await userEvent.keyboard("{Home}");
    await waitFor(() =>
      expect(canvas.getByText("Sessions", { exact: true }).closest("[data-tree-list-focus-id]")).toHaveFocus(),
    );
  },
};

export const ReorderVisibleRows: Story = {};

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

export const ReorderSections: Story = { render: () => <VirtualSections /> };

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

export const MoveIntoGroup: Story = { render: () => <VirtualGroups /> };
