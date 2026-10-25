import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { TreeList } from "./tree-list";

const NavigableBranch = () => {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [opened, setOpened] = useState("Nothing open");
  return (
    <Stack>
      <TreeList
        sections={[
          {
            id: "project",
            nodes: [
              {
                id: "notes",
                label: "Notes",
                isContainer: true,
                navigationIntent: { id: "page", payload: "notes" },
                children: [{ id: "note", label: "First note", navigationIntent: { id: "resource", payload: "note" } }],
              },
            ],
          },
        ]}
        expandedNodeIds={expanded}
        onToggleNode={(id) =>
          setExpanded((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))
        }
        onNavigate={({ node }) => setOpened(node.label)}
      />
      <Text role="status">{opened}</Text>
    </Stack>
  );
};

const meta = {
  title: "Components/Data Display/Tree List/Branch navigation",
  component: NavigableBranch,
  tags: ["tree-branch-navigation"],
} satisfies Meta<typeof NavigableBranch>;
export default meta;

export const PageAndChildren: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notes = canvas.getByRole("option", { name: "Notes" });
    await expect(within(notes).queryByRole("button", { name: /^(Expand|Collapse) group$/ })).toBeNull();
    await userEvent.click(notes);
    await expect(canvas.getByRole("status")).toHaveTextContent("Notes");
    await expect(notes).toHaveAttribute("aria-expanded", "true");
    await expect(await canvas.findByRole("option", { name: "First note" })).toBeVisible();
    await userEvent.click(notes);
    await expect(notes).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(notes.querySelector("svg[data-open]")!);
    await expect(notes).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByRole("status")).toHaveTextContent("Notes");
    await userEvent.click(canvas.getByRole("option", { name: "First note" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("First note");
  },
};
