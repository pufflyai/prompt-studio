import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture } from "./fixture";
import { moveStoryTab } from "./tab-moves";
import { visibleWindowingLabel } from "./visible-label";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;
const args = { createFixture: () => createWindowingFixture("windowing", { pagePanels: true }) };
const panel = (element: HTMLElement, region: string) =>
  element.querySelector(`[data-workbench-panel="${region}"]`) as HTMLElement;
const mainHeader = (element: HTMLElement) =>
  element.querySelector('[data-workbench-panel-header="main"]') as HTMLElement;
const move = async (element: HTMLElement, name: string, destination: string) => {
  await moveStoryTab(within(element).getByRole("tab", { name }), destination);
};

export const NoteReuse: Story = {
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("button", { name: "Note A" })[0]);
    await userEvent.type(canvas.getByRole("textbox", { name: "Notes draft" }), "Keep my note draft");
    const mount = visibleWindowingLabel(canvasElement, "Notes mount").textContent;
    await move(mainHeader(canvasElement), "Note A", "Side");
    await expect(within(panel(canvasElement, "main")).getByRole("heading", { name: "Notes" })).toBeVisible();
    await userEvent.click(canvas.getAllByRole("button", { name: "Note A" })[0]);
    const draft = within(panel(canvasElement, "side")).getByRole("textbox", { name: "Notes draft" });
    await expect(draft).toHaveValue("Keep my note draft");
    await expect(visibleWindowingLabel(panel(canvasElement, "side"), "Notes mount")).toHaveTextContent(mount!);
    await expect(canvas.getAllByRole("tab", { name: "Note A" })).toHaveLength(1);
    await waitFor(() => expect(draft).toHaveFocus());
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await userEvent.click(canvas.getAllByRole("button", { name: "Note A" })[0]);
    await expect(within(panel(canvasElement, "side")).getByRole("tab", { name: "Note A" })).toBeVisible();
    await expect(within(panel(canvasElement, "main")).queryByRole("tab", { name: "Note A" })).toBeNull();
  },
};

export const NoteNeighbor: Story = {
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of ["Note A", "Note B", "Note A"])
      await userEvent.click(canvas.getAllByRole("button", { name })[0]);
    await userEvent.type(canvas.getByRole("textbox", { name: "Notes draft" }), "A stays editable");
    await move(mainHeader(canvasElement), "Note A", "Secondary");
    await expect(within(mainHeader(canvasElement)).getByRole("tab", { name: "Note B", selected: true })).toBeVisible();
    await userEvent.click(canvas.getAllByRole("button", { name: "Note A" })[0]);
    await expect(within(panel(canvasElement, "secondary")).getByRole("textbox", { name: "Notes draft" })).toHaveValue(
      "A stays editable",
    );
    await expect(within(mainHeader(canvasElement)).getByRole("tab", { name: "Note B", selected: true })).toBeVisible();
    await expect(canvas.getAllByRole("tab", { name: "Note A" })).toHaveLength(1);
  },
};

export const InactiveOwnerReload: Story = {
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("button", { name: "Note A" })[0]);
    await userEvent.click(canvas.getAllByRole("button", { name: "Workspace 2" })[0]);
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await userEvent.click(canvas.getAllByRole("button", { name: "Note A" })[0]);
    await waitFor(() => expect(canvas.getByRole("textbox", { name: "Notes draft" })).toHaveFocus());
    await expect(canvas.getAllByRole("tab", { name: "Note A" })).toHaveLength(1);
  },
};

export const InactiveMainDocument: Story = {
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("button", { name: "Note A" })[0]);
    await userEvent.type(canvas.getByRole("textbox", { name: "Notes draft" }), "A keeps its owner");
    const mount = visibleWindowingLabel(canvasElement, "Notes mount").textContent;
    await userEvent.click(canvas.getAllByRole("button", { name: "Note B" })[0]);
    await userEvent.click(canvas.getAllByRole("button", { name: "Workspace 2" })[0]);
    await userEvent.click(canvas.getAllByRole("button", { name: "Note A" })[0]);
    await expect(within(mainHeader(canvasElement)).getByRole("tab", { name: "Note A", selected: true })).toBeVisible();
    await expect(
      within(canvas.getByRole("navigation", { name: "breadcrumb" })).getByText("Note A", { exact: true }),
    ).toBeVisible();
    const main = panel(canvasElement, "main");
    await expect(within(main).getByRole("textbox", { name: "Notes draft" })).toHaveValue("A keeps its owner");
    await expect(visibleWindowingLabel(main, "Notes mount")).toHaveTextContent(mount!);
    await waitFor(() => expect(within(main).getByRole("textbox", { name: "Notes draft" })).toHaveFocus());
  },
};

export const WorkspaceCatalog: Story = {
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = mainHeader(canvasElement);
    await userEvent.click(within(header).getByRole("tab", { name: "Files" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Files draft" }), "Keep Files in Side");
    await move(header, "Files", "Side");
    await userEvent.click(within(mainHeader(canvasElement)).getByRole("button", { name: "Add panel" }));
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Files" }));
    await expect(within(panel(canvasElement, "side")).getByRole("textbox", { name: "Files draft" })).toHaveValue(
      "Keep Files in Side",
    );
    await waitFor(() =>
      expect(within(panel(canvasElement, "side")).getByRole("textbox", { name: "Files draft" })).toHaveFocus(),
    );
    await expect(within(header).queryByRole("tab", { name: "Files" })).toBeNull();
    await move(header, "Changes", "Secondary");
    await userEvent.click(within(panel(canvasElement, "main")).getAllByRole("button", { name: "Add panel" })[0]);
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Changes" }));
    await expect(
      within(panel(canvasElement, "secondary")).getByRole("tab", { name: "Changes", selected: true }),
    ).toBeVisible();
  },
};

export const WorkspaceCatalogClose: Story = {
  args,
  play: async ({ canvasElement }) => {
    for (const name of ["Files", "Changes"]) {
      const header = within(mainHeader(canvasElement));
      await userEvent.click(header.getByRole("tab", { name }));
      await userEvent.click(header.getByRole("button", { name: `Close ${name}` }));
      await expect(header.queryByRole("tab", { name })).toBeNull();
      await userEvent.click(header.getByRole("button", { name: "Add panel" }));
      await userEvent.click(await within(document.body).findByRole("menuitem", { name }));
      await expect(header.getByRole("tab", { name, selected: true })).toBeVisible();
    }
  },
};

export const CollectionCatalog: Story = {
  args: {
    createFixture: () => {
      const fixture = createWindowingFixture("windowing", { pagePanels: true });
      const page = fixture.workbench.pages.getPage("windowing.workspace")!;
      page.panelMenus = undefined;
      return fixture;
    },
  },
  play: async ({ canvasElement }) => {
    const main = within(panel(canvasElement, "main"));
    for (const name of ["Files", "Changes"]) {
      await userEvent.click(main.getByRole("tab", { name }));
      await userEvent.click(main.getByRole("button", { name: `Close ${name}` }));
    }
    await expect(main.queryByRole("tab", { name: "Files" })).toBeNull();
    await expect(main.getByRole("button", { name: "Open Files" })).toBeVisible();
    await userEvent.click(within(mainHeader(canvasElement)).getByRole("button", { name: "Add panel" }));
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Files" }));
    await expect(main.getByRole("tab", { name: "Files", selected: true })).toBeVisible();
  },
};
