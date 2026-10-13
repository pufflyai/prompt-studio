import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture } from "./fixture";
import { windowingExtensionId, windowingPages } from "./resources";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MixedDocumentTabs: Story = {
  args: {
    createFixture: () => {
      const fixture = createWindowingFixture("windowing", { pagePanels: true });
      const w = fixture.workbench;
      for (const resource of fixture.resources.notes)
        w.pageLocations.navigate({ kind: "page", page: windowingPages.notes, resource, open: "pin" });
      void w.navigation.openTarget({
        kind: "panel",
        panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
        resource: fixture.resources.sessions[0],
        open: "pin",
      });
      const layout = w.layout.getLayout();
      const a = layout.regions.main.widgets.find((tab) => tab.resource?.id === "note-a")!;
      const session = layout.regions.side.widgets.find((tab) => tab.resource?.id === "session-1")!;
      w.movePanel(session.widgetId, "main", { afterWidgetId: a.widgetId });
      w.pageLocations.navigate({
        kind: "page",
        page: windowingPages.notes,
        resource: fixture.resources.notes[0],
        open: "pin",
      });
      return fixture;
    },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(within(canvasElement).getByRole("textbox", { name: "Notes draft" })).toHaveFocus());
    const header = within(canvasElement.querySelector('[data-workbench-panel-header="main"]') as HTMLElement);
    header.getByRole("tab", { name: "Note A" }).focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Move to Sidebar" }));
    await expect(header.getByRole("tab", { name: "Note B", selected: true })).toBeVisible();
    await expect(
      within(within(canvasElement).getByRole("navigation", { name: "breadcrumb" })).getByText("Note B", {
        exact: true,
      }),
    ).toBeVisible();
  },
};
