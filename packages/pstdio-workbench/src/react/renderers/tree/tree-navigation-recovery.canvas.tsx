import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const createFixture = (initialFailure: boolean) => {
  const workbench = createWorkbench();
  let failure = initialFailure;
  let reads = 0;
  const refresh = (fail: boolean) => {
    failure = fail;
    workbench.views.refreshView("navigation");
  };
  workbench.views.registerView({
    id: "navigation",
    title: "Navigation",
    body: {
      kind: "tree",
      getChildren: () => [],
      getHeader: () => [{ id: "header", nodes: [{ id: "search", label: "Search" }] }],
      getFooter: () => [{ id: "footer", nodes: [{ id: "settings", label: "Settings" }] }],
      getBody: () => {
        reads++;
        if (failure) throw new Error("Navigation refresh failed");
        return [{ id: "tools", nodes: [{ id: "notes", label: `Notes ${reads}` }] }];
      },
    },
  });
  workbench.views.registerView({
    id: "guide",
    title: "Navigation recovery",
    body: {
      kind: "react",
      render: () => (
        <Stack p="md" gap="md">
          <Button onClick={() => refresh(true)}>Fail refresh</Button>
          <Button onClick={() => refresh(false)}>Restore navigation</Button>
        </Stack>
      ),
    },
  });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.pages.registerPage({
    id: "guide",
    ref: { kind: "page", extensionId: "preview", id: "guide" },
    modeId: "project",
    path: "",
    main: { kind: "view", view: { kind: "view", id: "guide" }, cardinality: "one" },
    slots: [],
  });
  workbench.shellPlacements.registerPlacement({
    id: "navigation",
    region: "sidenav",
    item: { kind: "view", presence: "fixed", view: { kind: "view", id: "navigation" } },
  });
  workbench.pageLocations.setProject("preview");
  workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "preview", id: "guide" } });
  return workbench;
};
const NavigationRecovery = (props: { initialFailure: boolean }) => {
  const { initialFailure } = props;
  const [workbench] = useState(() => createFixture(initialFailure));
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Guides/Navigation recovery",
  component: NavigationRecovery,
  args: { initialFailure: false },
  fullscreen: true,
} satisfies CanvasMeta<typeof NavigationRecovery>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const FailedRefresh: Story = {
  id: "pstdio-workbench-guides-navigation-recovery--failed-refresh",
};
export const InitialFailure: Story = {
  id: "pstdio-workbench-guides-navigation-recovery--initial-failure",
  args: { initialFailure: true },
};
