import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture } from "./fixture";
import { visibleWindowingLabel } from "./visible-label";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ForeignContext: Story = {
  args: { createFixture: () => createWindowingFixture("windowing", { pagePanels: true, contextNavigation: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const main = canvasElement.querySelector('[data-workbench-panel="main"]') as HTMLElement;
    const breadcrumb = main.querySelector("nav")!;
    const original = breadcrumb.textContent;
    await userEvent.click(within(main).getByRole("tab", { name: "Changes" }));
    await userEvent.click(within(main).getByRole("button", { name: "Close Changes" }));
    await userEvent.click(canvas.getByRole("button", { name: "Session 2" }));
    const foreign = await canvas.findByRole("tab", { name: "Session 2 · Outside this workspace · Workspace 2" });
    await userEvent.click(foreign);
    await expect(breadcrumb).toHaveTextContent(original!);
    await expect(visibleWindowingLabel(canvasElement, "Session context")).toHaveTextContent("Workspace 2");
    const nav = canvasElement.querySelector('[data-workbench-region="sidenav"]')!;
    await expect(within(nav as HTMLElement).getByRole("option", { name: "Workspace 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.hover(foreign);
    await expect(await within(document.body).findByRole("tooltip")).toHaveTextContent(
      "Outside this workspace · Workspace 2",
    );
    await userEvent.unhover(foreign);
    await userEvent.click(canvas.getByRole("button", { name: "Grow Secondary" }));
    foreign.focus();
    await expect(await within(document.body).findByRole("tooltip")).toHaveTextContent(
      "Outside this workspace · Workspace 2",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Use project session context" }));
    await expect(
      await canvas.findByRole("tab", { name: "Session 2 · Outside this workspace · Project" }),
    ).toBeVisible();
    await expect(visibleWindowingLabel(canvasElement, "Session context")).toHaveTextContent("Project");
    await userEvent.click(within(main).getByRole("button", { name: "Add panel" }));
    const changes = within(document.body).queryByRole("menuitem", { name: "Changes" });
    if (changes) await userEvent.click(changes);
    await waitFor(() =>
      expect(visibleWindowingLabel(canvasElement, "Changes context")).toHaveTextContent("Workspace 1"),
    );
    await expect(breadcrumb).toHaveTextContent(original!);
    await userEvent.click(canvas.getByRole("button", { name: "Session 1" }));
    await expect(canvas.getByRole("tab", { name: "Session 1" })).toBeVisible();
    await expect(breadcrumb).toHaveTextContent(original!);
  },
};

export const PageAvailability: Story = {
  args: { createFixture: () => createWindowingFixture("windowing", { pageModes: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Library" }));
    await expect(visibleWindowingLabel(canvasElement, "Availability page")).toHaveTextContent("Library");
    await userEvent.click(canvas.getByRole("button", { name: "Boombox" }));
    await expect(visibleWindowingLabel(canvasElement, "Availability page")).toHaveTextContent("Overview");
    await expect(canvas.queryByRole("button", { name: "Scene" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Library" }));
    await userEvent.click(canvas.getByRole("button", { name: "Kiln" }));
    await expect(visibleWindowingLabel(canvasElement, "Availability page")).toHaveTextContent("Overview");
    await expect(canvas.queryByRole("button", { name: "Library" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Scene" }));
    await userEvent.click(canvas.getByRole("button", { name: "Boombox" }));
    await expect(visibleWindowingLabel(canvasElement, "Availability page")).toHaveTextContent("Library");
    await userEvent.click(canvas.getByRole("button", { name: "Navigate back" }));
    await waitFor(() => expect(canvas.getByLabelText("Current mode")).toHaveTextContent("Kiln"));
    await expect(visibleWindowingLabel(canvasElement, "Availability page")).toHaveTextContent("Scene");
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await expect(canvas.getByLabelText("Current mode")).toHaveTextContent("Kiln");
    await expect(visibleWindowingLabel(canvasElement, "Availability page")).toHaveTextContent("Scene");
  },
};
