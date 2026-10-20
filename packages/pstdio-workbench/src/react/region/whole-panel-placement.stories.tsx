import { IconButton, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { getWorkbenchRenderers } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createArrangementWorkbench } from "./panel-arrangement.stories";

const createPlacementWorkbench = () => {
  const w = createArrangementWorkbench();
  for (const region of ["sidenav", "activity"] as const) {
    getWorkbenchRenderers(w).registerRenderer({
      id: region,
      render: () =>
        region === "activity" ? (
          <IconButton aria-label="Action" size="sm" variant="ghost">
            <Text>A</Text>
          </IconButton>
        ) : (
          <Text p="md">Navigation content</Text>
        ),
    });
    w.layout.registerPanel({ id: region, title: region, rendererId: region, region });
    w.layout.openPanel(region, { pinned: true });
  }
  return w;
};
const PlacementStory = (props: { restricted?: boolean }) => {
  const [workbench] = useState(() => {
    const core = createPlacementWorkbench();
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
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Whole panel placement",
  component: PlacementStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PlacementStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Restricted: Story = { args: { restricted: true } };
