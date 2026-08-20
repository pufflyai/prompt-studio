import { Box } from "@chakra-ui/react";
import { createWorkbenchCore } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { showDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";
import { registerExtensionSidenavContributions } from "../extensions/extension-sidenav-contributions";
import { createSidenavModule } from "./module";

const PROJECT_ID = "demo-project";

// Planner-style metadata: the Tickets tree item is a `group: null` root item that
// opens the Tickets browse-root resource; the Lab item keeps the undefined-group
// default and lands under the "Extensions" heading for contrast.
const metadata = {
  ...emptyDashboardExtensionMetadata,
  extensions: [{ id: "pstdio.planner", name: "pstdio-planner", displayName: "Planner", sourcePath: "" }],
  panels: [
    {
      id: "pstdio-planner.tickets",
      extensionId: "pstdio.planner",
      title: "Tickets",
      supportedRegions: ["main"],
      renderer: { kind: "kanban", id: "pstdio-planner.tickets" },
    },
  ],
  treeItems: [
    {
      id: "pstdio-planner.tickets",
      extensionId: "pstdio.planner",
      target: "workbench.left.tree",
      label: "Tickets",
      icon: "square-kanban",
      group: null,
      placement: "first",
      action: {
        kind: "resource",
        resource: { type: "extension-view", id: "pstdio-planner.tickets" },
      },
    },
    {
      id: "pstdio.lab.labPage",
      extensionId: "pstdio.extension-lab",
      target: "workbench.left.tree",
      label: "Lab",
      icon: "flask-conical",
      action: { kind: "command", commandId: "extension-lab.open" },
    },
  ],
} satisfies DashboardExtensionMetadata;

const workbench = createWorkbenchCore();
workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
workbench.registerModule(createSidenavModule());
workbench.registerModule({
  id: "story.root-tree-items",
  activate(ctx) {
    registerExtensionSidenavContributions(ctx, () => ({ metadata, projectId: PROJECT_ID }));
    ctx.modes.setActiveMode("project");
    showDashboardSidenav(ctx);
    return [];
  },
});

const meta = {
  title: "Dashboard/SidenavRootItems",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj;

// The `group: null` Tickets item renders at the tree root without a section
// heading, while the undefined-group Lab item keeps the "Extensions" heading.
export const HeaderlessRootItem: Story = {
  render: () => (
    <Box h="100dvh" w="full">
      <Workbench workbench={workbench} />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Tickets")).toBeVisible();
    await expect(canvas.getByText("Extensions")).toBeVisible();
    const tickets = canvas.getByText("Tickets");
    const extensionsHeading = canvas.getByText("Extensions");
    // The root item sits above the grouped section, outside any heading.
    expect(tickets.compareDocumentPosition(extensionsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  },
};
