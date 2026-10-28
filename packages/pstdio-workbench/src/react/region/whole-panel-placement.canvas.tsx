import { IconButton, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { getWorkbenchRenderers } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createArrangementWorkbench } from "./panel-arrangement.canvas";

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
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PlacementStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Dark: Story = { args: { dark: true } };
export const Reversed: Story = { args: { reversed: true } };
export const EmbeddedNavigation: Story = { args: { embeddedNavigation: true } };
export const Restricted: Story = { args: { restricted: true } };

const checkPanelPosition = (canvasElement: HTMLElement, region: string, position: string) => {
  const vertical = position === "left" || position === "right";
  const axis = vertical ? "x" : "y";
  const direction = position === "left" || position === "top" ? -1 : 1;
  const moved = canvasElement.querySelector<HTMLElement>(
    region === "main" ? '[data-workbench-panel="main"]' : `[data-workbench-panel-drag="${region}"]`,
  )!;
  const reference = canvasElement.querySelector<HTMLElement>(
    `[data-workbench-panel="${region === "main" ? "secondary" : "main"}"]`,
  )!;
  const bounds = moved.getBoundingClientRect();
  if (region === "activity") expect(bounds.height > bounds.width).toBe(vertical);
  expect(direction * (bounds[axis] - reference.getBoundingClientRect()[axis])).toBeGreaterThan(0);
};

const checkMoveActions = async (canvasElement: HTMLElement, reversed = false) => {
  const body = within(canvasElement.ownerDocument.body);
  for (const [region, initial, destination] of [
    ["side", "right", "left"],
    ["secondary", "bottom", "top"],
    ["main", "top", "bottom"],
    ["sidenav", "left", "right"],
    ["activity", "left", "bottom"],
  ] as const) {
    const current = reversed ? destination : initial;
    const next = reversed ? initial : destination;
    const label = region === "activity" ? "action bar" : "panel";
    for (const [from, to] of [
      [current, next],
      [next, current],
    ]) {
      const header = canvasElement.querySelector<HTMLElement>(`[data-workbench-panel-drag="${region}"]`)!;
      header.focus();
      await userEvent.keyboard("{Shift>}{F10}{/Shift}");
      await expect(body.queryByRole("menuitem", { name: `Move ${label} to ${from}` })).toBeNull();
      await expect(body.getAllByRole("menuitem", { name: /^Move (panel|action bar) to / })).toHaveLength(
        region === "activity" ? 3 : 1,
      );
      await userEvent.click(body.getByRole("menuitem", { name: `Move ${label} to ${to}` }));
      await waitFor(() => checkPanelPosition(canvasElement, region, to));
      await userEvent.keyboard("{Escape}");
    }
  }
};

export const MoveActions: Story = { play: async ({ canvasElement }) => checkMoveActions(canvasElement) };
export const ReversedMoveActions: Story = {
  args: { reversed: true },
  play: async ({ canvasElement }) => checkMoveActions(canvasElement, true),
};
