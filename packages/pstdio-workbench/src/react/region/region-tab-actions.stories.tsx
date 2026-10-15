import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { createWindowingFixture } from "../../examples/windowing/fixture";
import { WindowingStory } from "../../examples/windowing/windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Tab actions",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
export const PinAndClose: StoryObj<typeof meta> = {
  args: { createFixture: () => createWindowingFixture("windowing", { pagePanels: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(canvas.getAllByRole("button", { name: "Note A" })[0]);
    const tab = canvas.getByRole("tab", { name: "Note A" });
    tab.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await body.findByRole("menu", { name: "Note A context menu" });
    await userEvent.keyboard("{Escape}");
    await expect(tab).toHaveFocus();
    for (const name of ["Unpin tab", "Pin tab", "Close tab"]) {
      tab.focus();
      await userEvent.keyboard("{Shift>}{F10}{/Shift}");
      const menu = await body.findByRole("menu", { name: "Note A context menu" });
      await expect(within(menu).getAllByRole("menuitem")).toHaveLength(2);
      await userEvent.click(within(menu).getByRole("menuitem", { name }));
    }
    await expect(
      within(canvasElement.querySelector('[data-workbench-panel-header="main"]') as HTMLElement).getByRole("tab", {
        name: "Notes",
      }),
    ).toBeVisible();
  },
};
