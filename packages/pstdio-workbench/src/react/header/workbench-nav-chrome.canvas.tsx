import { Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
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

const checkPanelControls = async (canvasElement: HTMLElement, open: boolean) => {
  const nav = canvasElement.querySelector<HTMLElement>('[data-workbench-region="nav"]')!;
  const controls = within(nav).getByRole("group", { name: "Panel controls" });
  const buttons = within(controls).getAllByRole("button");
  await expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
    `${open ? "Hide" : "Show"} Sidenav`,
    "Hide Bottom Panel",
    "Hide Side Panel",
  ]);
  await expect(controls.getBoundingClientRect().left).toBeGreaterThan(
    nav.getBoundingClientRect().left + nav.clientWidth / 2,
  );
  await userEvent.click(buttons[0]);
  await expect(within(controls).getByRole("button", { name: `${open ? "Show" : "Hide"} Sidenav` })).toBeVisible();
  await expect(within(controls).getAllByRole("button")).toHaveLength(3);
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Browser panel controls",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SidenavOpen: Story = {
  args: { workbench: createNavigationWorkbench() },
  play: async ({ canvasElement }) => checkPanelControls(canvasElement, true),
};

export const SidenavClosed: Story = {
  args: {
    workbench: (() => {
      const workbench = createNavigationWorkbench();
      workbench.shell.setRegionOpen("sidenav", false);
      return workbench;
    })(),
  },
  play: async ({ canvasElement }) => checkPanelControls(canvasElement, false),
};
