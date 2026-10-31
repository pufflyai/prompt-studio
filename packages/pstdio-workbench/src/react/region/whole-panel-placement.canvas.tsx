import { IconButton, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { getWorkbenchRenderers } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createArrangementWorkbench } from "./panel-arrangement-workbench";

const createPlacementWorkbench = (embeddedNavigation = false) => {
  const w = createArrangementWorkbench();
  w.shell.setHeaderVisible("main", true);
  for (const region of ["sidenav", "activity"] as const) {
    getWorkbenchRenderers(w).registerRenderer({
      id: region,
      render: () => {
        if (region === "activity")
          return (
            <IconButton aria-label="Action" size="sm" variant="ghost">
              <Text>A</Text>
            </IconButton>
          );
        if (embeddedNavigation)
          return <iframe title="Navigation view" srcDoc="<h1>Navigation</h1>" width="100%" height="100%" />;
        return <Text p="md">Navigation content</Text>;
      },
    });
    w.layout.registerPanel({ id: region, title: region, rendererId: region, region });
    w.layout.openPanel(region, { pinned: true });
  }
  return w;
};
const PlacementStory = (props: {
  restricted?: boolean;
  reversed?: boolean;
  dark?: boolean;
  embeddedNavigation?: boolean;
}) => {
  const [workbench] = useState(() => {
    const core = createPlacementWorkbench(props.embeddedNavigation);
    if (props.reversed) {
      core.shell.repositionPanel("side", "left");
      core.shell.repositionPanel("secondary", "top");
      core.shell.repositionPanel("sidenav", "right");
      core.shell.repositionPanel("activity", "bottom");
    }
    if (props.restricted)
      core.modes.getMode("arrangement")!.regionSettings = {
        main: { movable: false },
        secondary: { movable: false },
        side: { movable: false },
        sidenav: { movable: false },
        activity: { movable: false },
      };
    return core;
  });
  return <WorkbenchStory workbench={workbench} initialThemePreference={props.dark ? "pstdio-dark" : "pstdio-light"} />;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Whole panel placement",
  component: PlacementStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof PlacementStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Interactive: Story = {
  id: "pstdio-workbench-reference-core-api-whole-panel-placement--interactive",
};
export const Dark: Story = {
  id: "pstdio-workbench-reference-core-api-whole-panel-placement--dark",
  args: { dark: true },
};
export const Reversed: Story = {
  id: "pstdio-workbench-reference-core-api-whole-panel-placement--reversed",
  args: { reversed: true },
};
export const EmbeddedNavigation: Story = {
  id: "pstdio-workbench-reference-core-api-whole-panel-placement--embedded-navigation",
  args: { embeddedNavigation: true },
};
export const Restricted: Story = {
  id: "pstdio-workbench-reference-core-api-whole-panel-placement--restricted",
  args: { restricted: true },
};
export const MoveActions: Story = {
  id: "pstdio-workbench-reference-core-api-whole-panel-placement--move-actions",
};
export const ReversedMoveActions: Story = {
  id: "pstdio-workbench-reference-core-api-whole-panel-placement--reversed-move-actions",
  args: { reversed: true },
};
