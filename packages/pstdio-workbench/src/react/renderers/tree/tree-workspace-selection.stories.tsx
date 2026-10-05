import { TreeList } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import type { TreeViewSection } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { resolveTreeListSelection } from "./tree-list-adapter";

const ticketPage = { kind: "page", extensionId: "planner", id: "ticket" } as const;
const workspacePage = { kind: "page", extensionId: "pstdio", id: "workspace" } as const;
const ticket = { type: "ticket", id: "ticket" };
const workspace = (id: string) => ({ type: "workspace", id });
const sections = [
  {
    id: "context",
    label: "Ticket context",
    collapsible: false,
    nodes: [
      {
        id: "body",
        label: "Ticket body",
        selected: true,
        target: { kind: "page", page: ticketPage, resource: ticket },
      },
      ...["first", "second"].map((id) => ({ id, label: `${id} workspace`, resource: workspace(id) })),
    ],
  },
] satisfies TreeViewSection[];

const WorkspaceSelection = () => {
  const [selected, setSelected] = useState("first");
  const resource = selected === "body" ? ticket : workspace(selected);
  const activeNodeId = resolveTreeListSelection({
    sections,
    childrenByNodeId: {},
    activeResource: resource,
    activeLocation: { page: selected === "body" ? ticketPage : workspacePage, resource },
  });
  return (
    <TreeList
      sections={sections.map((section) => ({
        ...section,
        nodes: section.nodes.map((node) => ({
          id: node.id,
          label: node.label,
          isNavigable: true,
        })),
      }))}
      activeNodeId={activeNodeId}
      onNavigate={(event) => setSelected(event.nodeId)}
    />
  );
};
const meta = {
  title: "pstdio-workbench/Guides/Workspace selection",
  component: WorkspaceSelection,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof WorkspaceSelection>;
export default meta;
type Story = StoryObj<typeof meta>;
export const TicketContext: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("option", { name: "first workspace" })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("option", { name: "Ticket body" })).toHaveAttribute("aria-selected", "false");
    await userEvent.click(canvas.getByRole("option", { name: "second workspace" }));
    await expect(canvas.getByRole("option", { name: "second workspace" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(canvas.getByRole("option", { name: "Ticket body" }));
    await expect(canvas.getByRole("option", { name: "Ticket body" })).toHaveAttribute("aria-selected", "true");
  },
};
