import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { Ellipsis } from "lucide-react";
import { useRef, useState } from "react";
import { TreeList } from "./tree-list";

const MotionTree = (props: { draggable?: boolean; virtualize?: boolean }) => {
  const { draggable = false, virtualize = false } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState(["workspaces", "tools"]);
  const [nodes, setNodes] = useState<string[]>([]);
  const toggle = (values: string[], id: string) =>
    values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
  return (
    <Box w="80" h={virtualize ? "64" : undefined} overflowY={virtualize ? "auto" : undefined} ref={scrollRef}>
      <TreeList
        virtualize={virtualize}
        scrollRef={scrollRef}
        nodeGap="1"
        draggable={draggable}
        onReorderSections={() => {}}
        onReorderNodes={() => {}}
        sections={[
          {
            id: "workspaces",
            label: "Workspaces",
            nodes: [
              {
                id: "research",
                label: "Research",
                children: [
                  {
                    id: "notes",
                    label: "Meeting notes",
                    actions: [{ id: "actions", label: "Note actions", icon: <Ellipsis /> }],
                  },
                ],
              },
            ],
          },
          { id: "tools", label: "Tools", nodes: [{ id: "planner", label: "Planner" }] },
        ]}
        expandedSectionIds={sections}
        expandedNodeIds={nodes}
        activeNodeId="research"
        onToggleSection={(id) => setSections(toggle(sections, id))}
        onToggleNode={(id) => setNodes(toggle(nodes, id))}
      />
    </Box>
  );
};
const meta = {
  title: "Components/Tree List/Motion",
  component: MotionTree,
} satisfies CanvasMeta<typeof MotionTree>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const NestedGroups: Story = {
  id: "components-tree-list-motion--nested-groups",
};
export const SortableGroups: Story = {
  id: "components-tree-list-motion--sortable-groups",
  ...NestedGroups,
  args: { draggable: true },
};
export const InstantVirtual: Story = {
  id: "components-tree-list-motion--instant-virtual",
  args: { virtualize: true },
};
export const SortableKeyboard: Story = {
  id: "components-tree-list-motion--sortable-keyboard",
  args: { draggable: true },
};
