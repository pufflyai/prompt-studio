import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createPageContextWorkbench = (routed = false) => {
  const page = { kind: "page" as const, extensionId: "storybook", id: "documents" };
  const workbench = createWorkbench({ startPage: page, initialSidePanelMode: "attached" });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.resources.registerKind({ kind: "note", label: "Note", icon: "file-text" });
  workbench.views.registerView({
    id: "editor",
    title: "Editor",
    body: { kind: "react", render: () => null },
  });
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Documents",
    path: "documents",
    modeId: "project",
    ...(routed ? { resource: { kinds: [{ kind: "resource-kind" as const, id: "workspace" }] } } : {}),
    main: { kind: "panels", empty: { kind: "view", id: "editor" } },
    slots: (["main", "side"] as const).map((region) => ({
      id: region,
      region,
      item: {
        kind: "binding" as const,
        binding: {
          kinds: [{ kind: "resource-kind" as const, id: "note" }],
          view: { kind: "view" as const, id: "editor" },
          cardinality: "many" as const,
        },
      },
      tab: {
        getSnapshot: () => ({
          menu: [{ id: "note", rows: [{ id: region, label: `${region} document action` }] }],
        }),
      },
    })),
  });
  workbench.pageLocations.setProject("storybook-context");
  workbench.pageLocations.navigate({
    kind: "page",
    page,
    ...(routed ? { resource: { type: "workspace", id: "workspace", label: "My workspace" } } : {}),
  });
  for (const region of ["main", "side"] as const) {
    workbench.pages.openSlot({
      pageId: page.id,
      slotId: region,
      resource: { type: "note", id: region, label: `${region} document` },
    });
  }
  return workbench;
};

const meta = {
  title: "pstdio-workbench/Guides/Page context",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CollectionDocument: Story = {
  args: { workbench: createPageContextWorkbench() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("tab", { name: "side document" }));
    const breadcrumb = within(canvas.getByRole("navigation", { name: "breadcrumb" }));
    await expect(breadcrumb.getByText("main document", { exact: true })).toBeVisible();
    await expect(breadcrumb.queryByText("side document", { exact: true })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Actions for main document" }));
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "main document action" }),
    ).toBeVisible();
  },
};

export const RoutedResource: Story = {
  args: { workbench: createPageContextWorkbench(true) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of ["main document", "side document"]) {
      await userEvent.click(await canvas.findByRole("tab", { name: label }));
      const breadcrumb = within(canvas.getByRole("navigation", { name: "breadcrumb" }));
      await expect(breadcrumb.getByText("My workspace", { exact: true })).toBeVisible();
      await expect(breadcrumb.queryByText(label, { exact: true })).not.toBeInTheDocument();
    }
  },
};
