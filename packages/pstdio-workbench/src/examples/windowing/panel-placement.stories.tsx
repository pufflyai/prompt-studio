import { Button, HStack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../../react";
import { createWindowingFixture } from "./fixture";
import { WindowingStory } from "./windowing-story";

const ActionBar = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const edge = useWorkbenchStore(workbench.layout.store, (state) => state.layout.actionBarEdge ?? "left");
  return (
    <HStack flexDirection={edge === "left" || edge === "right" ? "column" : "row"} p="xs">
      <Button size="xs">Project</Button>
      <Button size="xs">Tools</Button>
    </HStack>
  );
};
const fixture = () => {
  const f = createWindowingFixture("windowing", {
    pagePanels: true,
    contextNavigation: true,
    registerMode: (workbench) => {
      return workbench.modes.registerMode({
        id: "windowing",
        label: "Windowing",
        activate: () => [
          workbench.views.registerView({
            id: "placement.activity",
            title: "Action bar",
            body: { kind: "react", render: () => <ActionBar workbench={workbench} /> },
          }),
          workbench.shellPlacements.registerPlacement({
            id: "placement.activity",
            region: "activity",
            item: { kind: "view", view: { kind: "view", id: "placement.activity" }, presence: "fixed" },
          }),
        ],
      });
    },
  });
  return f;
};
const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;
const panel = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-workbench-panel="${id}"]`)!;
const move = async (root: HTMLElement, id: string, label: string) => {
  const header = root.querySelector<HTMLElement>(`[data-workbench-panel-drag="${id}"]`)!;
  header.focus();
  await userEvent.keyboard("{Shift>}{F10}{/Shift}");
  await userEvent.click(await within(document.body).findByRole("menuitem", { name: label }));
};
export const WholePanelPlacement: Story = {
  args: { createFixture: fixture },
  play: async ({ canvasElement: root }) => {
    const draft = within(root).getByRole("textbox", { name: "Files draft" });
    await userEvent.type(draft, "Keep the whole view");
    await userEvent.click(within(root).getByRole("button", { name: "Session 1" }));
    await move(root, "side", "Sidebar left");
    await waitFor(() =>
      expect(panel(root, "side").getBoundingClientRect().right).toBeLessThan(
        panel(root, "main").getBoundingClientRect().left,
      ),
    );
    await move(root, "sidenav", "Navigation far right");
    const nav = root.querySelector<HTMLElement>('[data-workbench-region="sidenav"]')!;
    await waitFor(() =>
      expect(nav.getBoundingClientRect().left).toBeGreaterThan(panel(root, "main").getBoundingClientRect().right),
    );
    await move(root, "secondary", "Flip Main and Secondary · secondary top");
    await waitFor(() =>
      expect(panel(root, "secondary").getBoundingClientRect().bottom).toBeLessThan(
        panel(root, "main").getBoundingClientRect().top,
      ),
    );
    await move(root, "bottom", "Page bottom panel top");
    await expect(draft).toHaveValue("Keep the whole view");
    await userEvent.click(within(root).getByRole("button", { name: "Reload fixture" }));
    await waitFor(() =>
      expect(panel(root, "side").getBoundingClientRect().right).toBeLessThan(
        panel(root, "main").getBoundingClientRect().left,
      ),
    );
  },
};
let actionBarFixture: ReturnType<typeof fixture>;
export const ActionBarEdges: Story = {
  args: {
    createFixture: () => {
      actionBarFixture = fixture();
      return actionBarFixture;
    },
  },
  play: async ({ canvasElement: root }) => {
    for (const edge of ["top", "right", "bottom", "left"]) {
      await move(root, "activity", `Action bar ${edge}`);
      await waitFor(() => expect(actionBarFixture.workbench.layout.getLayout().actionBarEdge).toBe(edge));
      const bar = root.querySelector<HTMLElement>('[data-workbench-region="activity"]')!;
      await waitFor(() =>
        expect(
          edge === "top" || edge === "bottom" ? bar.clientWidth > bar.clientHeight : bar.clientHeight > bar.clientWidth,
        ).toBe(true),
      );
      const bounds = bar.getBoundingClientRect();
      const frame = root.querySelector<HTMLElement>("[data-workbench-drag-frame]")!.getBoundingClientRect();
      await expect(
        Math.abs(
          bounds[edge as "left" | "right" | "top" | "bottom"] - frame[edge as "left" | "right" | "top" | "bottom"],
        ),
      ).toBeLessThanOrEqual(1);
    }
  },
};
export const ClosedEdgeReveal: Story = {
  args: {
    createFixture: () => {
      const f = fixture();
      for (const region of ["side", "secondary", "aside", "bottom"] as const)
        f.workbench.shell.setRegionOpen(region, false);
      return f;
    },
  },
  play: async ({ canvasElement: root }) => {
    await expect(within(panel(root, "main")).getByRole("tab", { name: /^Files/ })).toBeVisible();
    await expect(panel(root, "aside")).not.toBeVisible();
  },
};
export const TabInsertion: Story = {
  args: { createFixture: fixture },
  play: async ({ canvasElement: root }) => {
    const header = root.querySelector<HTMLElement>('[data-workbench-panel-header="main"]')!;
    const files = within(header).getByRole("tab", { name: /^Files/ });
    const changes = within(header).getByRole("tab", { name: /^Changes/ });
    files.focus();
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await expect(within(header).getAllByRole("tab")[0]).toBe(files);
    await expect(changes).toBeVisible();
  },
};
