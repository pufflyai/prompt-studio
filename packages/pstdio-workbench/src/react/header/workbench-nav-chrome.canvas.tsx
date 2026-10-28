import { Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createNavigationWorkbench = () => {
  const page = { kind: "page", extensionId: "storybook", id: "panel-controls" } as const;
  const workbench = createWorkbench({ startPage: page, initialSidePanelMode: "attached" });
  workbench.modes.registerMode({ id: "project", activate() {}, chrome: { sidenav: "navigation" } });
  for (const [id, title] of [
    ["navigation", "Project navigation"],
    ["main", "Project overview"],
    ["secondary", "Terminal"],
    ["side", "Session"],
  ]) {
    workbench.views.registerView({
      id,
      title,
      body: { kind: "react", render: () => <Text p="md">{title}</Text> },
    });
  }
  workbench.pages.registerPage({
    id: "panel-controls",
    ref: page,
    path: "panel-controls",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "main" }, cardinality: "one" },
    slots: [],
  });
  for (const region of ["secondary", "side"] as const) {
    workbench.modePlacements.registerPlacement({
      id: region,
      ref: { kind: "placement", extensionId: "storybook", id: region },
      modeId: "project",
      region,
      item: { kind: "view", view: { kind: "view", id: region }, presence: "open" },
    });
  }
  workbench.pageLocations.switchProject("storybook");
  workbench.pageLocations.navigate({ kind: "page", page });
  return workbench;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Browser panel controls",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const SidenavOpen: Story = {
  id: "pstdio-workbench-reference-core-api-browser-panel-controls--sidenav-open",
  args: { workbench: createNavigationWorkbench() },
};
export const SidenavClosed: Story = {
  id: "pstdio-workbench-reference-core-api-browser-panel-controls--sidenav-closed",
  args: {
    workbench: (() => {
      const workbench = createNavigationWorkbench();
      workbench.shell.setRegionOpen("sidenav", false);
      return workbench;
    })(),
  },
};
