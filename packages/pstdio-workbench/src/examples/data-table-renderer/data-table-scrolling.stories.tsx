import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../workbench-story";

const workbench = createWorkbench();
workbench.registerModule({
  id: "table-scrolling",
  activate(ctx) {
    ctx.views.registerView({
      id: "table-scrolling.rows",
      title: "Workspaces",
      body: {
        kind: "dataTable",
        columns: [{ id: "name", label: "Workspace", type: "string" }],
        initialPageSize: 50,
        defaultFilter: {
          conjunction: "and",
          rules: [{ attributeId: "name", condition: "contains", value: "Workspace" }],
        },
        executeQuery: () => ({
          rows: Array.from({ length: 53 }, (_, index) => ({
            id: `workspace-${index + 1}`,
            values: { name: `Workspace ${index + 1}` },
          })),
        }),
      },
    });
    ctx.shellPlacements.registerPlacement({
      id: "table-scrolling.rows",
      region: "main",
      item: { kind: "view", presence: "fixed", view: { kind: "view", id: "table-scrolling.rows" } },
    });
  },
});

const meta = {
  title: "pstdio-workbench/Reference/Core API/Native data table scrolling",
  component: WorkbenchStory,
  args: { workbench },
  parameters: { layout: "fullscreen", controls: { disable: true } },
  tags: ["!manifest"],
} satisfies Meta<typeof WorkbenchStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PinnedChrome: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("cell", { name: "Workspace 1" });
    const table = await canvas.findByRole("table");
    const viewport = table.closest<HTMLElement>("[data-part='viewport']")!;
    const bar = canvas.getByTestId("collection-view-bar");
    const criteria = canvas.getByTestId("collection-view-criteria");
    const footer = canvas.getByRole("button", { name: "Go to next page" }).parentElement!.parentElement!;
    const top = bar.getBoundingClientRect().top;
    const criteriaTop = criteria.getBoundingClientRect().top;
    const bottom = footer.getBoundingClientRect().bottom;
    const region = canvas.getByRole("region", { name: "Main" });
    await expect(bottom).toBeLessThanOrEqual(region.getBoundingClientRect().bottom);
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);

    viewport.scrollTop = viewport.scrollHeight;
    await fireEvent.scroll(viewport);
    await waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(0));
    await expect(bar.getBoundingClientRect().top).toBe(top);
    await expect(criteria.getBoundingClientRect().top).toBe(criteriaTop);
    await expect(footer.getBoundingClientRect().bottom).toBe(bottom);
    await expect(table.querySelector("thead tr")!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      viewport.getBoundingClientRect().top,
    );

    await userEvent.click(canvas.getByRole("button", { name: "Go to last page" }));
    await expect(await canvas.findByRole("cell", { name: "Workspace 53" })).toBeVisible();
    await expect(footer.getBoundingClientRect().bottom).toBe(bottom);

    await userEvent.click(canvas.getByRole("button", { name: "Search this view" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Search this view" }), "missing workspace");
    await expect(await canvas.findByRole("button", { name: "Clear search" })).toBeVisible();
    await expect(bar.getBoundingClientRect().top).toBe(top);
    await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
    await expect(await canvas.findByRole("cell", { name: "Workspace 53" })).toBeVisible();
    const restoredFooter = canvas.getByRole("button", { name: "Go to next page" }).parentElement!.parentElement!;
    await expect(restoredFooter.getBoundingClientRect().bottom).toBe(bottom);
  },
};
