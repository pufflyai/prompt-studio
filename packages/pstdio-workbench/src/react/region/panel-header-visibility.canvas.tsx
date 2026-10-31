import { Box, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench, headerTrailingMenuPath } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createPanelWorkbench = (
  options: { changes?: boolean; collapsed?: boolean; action?: boolean; panelResource?: boolean } = {},
) => {
  const page = { kind: "page", extensionId: "preview", id: "panel-header" } as const;
  const workbench = createWorkbench({ startPage: page });
  workbench.modes.registerMode({
    id: "panel-header",
    label: "Panel header",
    activate: () => undefined,
    regionSettings: {
      main: {
        showHeader: Boolean(options.changes || options.collapsed || options.action),
        alwaysShowTabs: Boolean(options.changes || options.collapsed),
      },
    },
  });
  for (const [id, title] of [
    ["files", "Files"],
    ["changes", "Changes"],
    ["file-tree", "File tree"],
  ]) {
    workbench.views.registerView({
      id,
      title,
      body: {
        kind: "react",
        render: () => (
          <Box p="md">
            <Text>{title} content</Text>
          </Box>
        ),
      },
    });
  }
  workbench.viewMenus.registerViewMenu({ id: "file-tree", ownerViewId: "files", viewId: "file-tree", side: "left" });
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Panel header",
    path: "panel-header",
    modeId: "panel-header",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "files" } },
    slots: [
      { id: "files", region: "main", item: { kind: "view", view: { kind: "view", id: "files" }, presence: "fixed" } },
      {
        id: "changes",
        region: "main",
        isAvailable: () => options.changes === true,
        item: { kind: "view", view: { kind: "view", id: "changes" }, presence: "fixed" },
      },
    ],
  });
  if (options.action) {
    workbench.commands.registerCommand({ id: "refresh", label: "Refresh files" }, { execute: () => undefined });
    workbench.layout.registerMenuItem(headerTrailingMenuPath("main"), {
      commandId: "refresh",
      group: "primary",
      ...(options.panelResource ? { when: 'workbench.resource.type == "file"' } : {}),
    });
  }
  workbench.pageLocations.switchProject("preview-panel-header");
  workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "workspace", id: "workspace-1" } });
  if (options.panelResource) {
    const panel = workbench.layout.listPanelInstances("main")[0];
    if (panel) workbench.layout.updatePanel(panel.instanceId, { resource: { type: "file", id: "notes.md" } });
  }
  if (options.collapsed) {
    const menu = workbench.layout.listPanelInstances("main-left-menu")[0];
    if (menu) workbench.panelMenuState.setOpen(`panel-menu:${menu.instanceId}`, false);
  }
  return workbench;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Panel header visibility",
  component: WorkbenchStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const SingleAvailableFixedPanel: Story = {
  id: "pstdio-workbench-reference-core-api-panel-header-visibility--single-available-fixed-panel",
  args: { workbench: createPanelWorkbench() },
};
export const MultipleAvailableFixedPanels: Story = {
  id: "pstdio-workbench-reference-core-api-panel-header-visibility--multiple-available-fixed-panels",
  args: { workbench: createPanelWorkbench({ changes: true }) },
};
export const CollapsedMenuWithTab: Story = {
  id: "pstdio-workbench-reference-core-api-panel-header-visibility--collapsed-menu-with-tab",
  args: { workbench: createPanelWorkbench({ collapsed: true }) },
};
export const HeaderActionWithoutTabs: Story = {
  id: "pstdio-workbench-reference-core-api-panel-header-visibility--header-action-without-tabs",
  args: { workbench: createPanelWorkbench({ action: true }) },
};
export const HeaderActionForPanelResource: Story = {
  id: "pstdio-workbench-reference-core-api-panel-header-visibility--header-action-for-panel-resource",
  ...HeaderActionWithoutTabs,
  args: { workbench: createPanelWorkbench({ action: true, panelResource: true }) },
};
export const SinglePageHeader: Story = {
  id: "pstdio-workbench-reference-core-api-panel-header-visibility--single-page-header",
  args: {
    workbench: (() => {
      const page = { kind: "page", extensionId: "preview", id: "start" } as const;
      const core = createWorkbench({ startPage: page });
      core.modes.registerMode({
        id: "start",
        label: "Start",
        activate: () => undefined,
        regionSettings: { main: { showHeader: false } },
      });
      core.views.registerView({
        id: "start",
        title: "Start",
        body: {
          kind: "react",
          render: () => <Text p="md">Start page content</Text>,
        },
      });
      core.pages.registerPage({
        id: page.id,
        ref: page,
        title: "Start",
        path: "",
        modeId: "start",
        main: { kind: "view", view: { kind: "view", id: "start" }, cardinality: "one" },
        slots: [],
      });
      core.pageLocations.switchProject("preview-start-header");
      core.pageLocations.navigate({ kind: "page", page });
      return core;
    })(),
  },
};
