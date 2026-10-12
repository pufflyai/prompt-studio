import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Ellipsis } from "lucide-react";
import { useRef, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
  tags: ["motion"],
  title: "Components/Tree List/Motion",
  component: MotionTree,
} satisfies Meta<typeof MotionTree>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NestedGroups: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("Research"));
    await waitFor(() => expect(canvas.getByText("Meeting notes")).toBeVisible());
    canvas.getByText("Meeting notes").closest<HTMLElement>("[role=option]")?.focus();
    await waitFor(() => expect(canvas.getByRole("button", { name: "Note actions" })).toBeVisible());
    await userEvent.click(canvas.getByText("Research"));
    await waitFor(() => expect(canvas.getByText("Meeting notes")).not.toBeVisible());
    await userEvent.click(canvas.getByText("Research"));
    await waitFor(() => expect(canvas.getByText("Meeting notes")).toBeVisible());
  },
};
export const SortableGroups: Story = { ...NestedGroups, args: { draggable: true } };
export const InstantVirtual: Story = {
  args: { virtualize: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("Research"));
    await waitFor(() => expect(canvas.getByText("Meeting notes")).toBeVisible());
    for (const chevron of canvasElement.querySelectorAll("[data-open]")) {
      await expect(getComputedStyle(chevron).transitionDuration).toBe("0s");
    }
  },
};
export const SortableKeyboard: Story = {
  tags: ["!manifest"],
  args: { draggable: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByText("Research").closest("[role=option]")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getByText("Meeting notes")).toBeVisible());
    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getByText("Meeting notes").closest("[role=option]")).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(canvas.getByText("Research").closest("[role=option]")).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(canvas.getByText("Meeting notes")).not.toBeVisible());
  },
};
