import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createPageContextWorkbench = (routed = false, contextView = false) => {
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
      item: contextView
        ? {
            kind: "view" as const,
            view: { kind: "view" as const, id: "editor" },
            presence: "open" as const,
          }
        : {
            kind: "binding" as const,
            binding: {
              kinds: [{ kind: "resource-kind" as const, id: "note" }],
              view: { kind: "view" as const, id: "editor" },
              cardinality: "many" as const,
            },
          },
      tab: {
        getSnapshot: () => ({
          ...(contextView ? { label: `${region} files` } : {}),
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
    if (contextView) continue;
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

export const RoutedContextView: Story = {
  tags: ["breadcrumb-resource-ownership"],
  args: { workbench: createPageContextWorkbench(true, true) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: "main files" })).toBeVisible();
    const breadcrumb = within(canvas.getByRole("navigation", { name: "breadcrumb" }));
    await expect(breadcrumb.getByText("My workspace", { exact: true })).toBeVisible();
    await expect(breadcrumb.queryByText("main files", { exact: true })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Actions for My workspace" }));
    const action = await within(canvasElement.ownerDocument.body).findByRole("menuitem", {
      name: "main document action",
    });
    await waitFor(() => expect(action).toBeVisible());
  },
};

const createComposerWorkbench = () => {
  const workbench = createWorkbench();
  const page = { kind: "page" as const, extensionId: "storybook", id: "compose" };
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({ id: "compose", title: "Compose", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "compose",
    ref: page,
    title: "Messages",
    path: "messages",
    modeId: "project",
    main: {
      kind: "view",
      presentation: "page",
      cardinality: "one",
      view: { kind: "view", id: "compose" },
      tab: {
        getSnapshot: () => ({
          label: "New message",
          menu: [
            {
              id: "compose",
              rows: [
                {
                  id: "open",
                  label: "Open message",
                  action: {
                    kind: "navigation",
                    target: {
                      kind: "viewer",
                      operation: "switch",
                      page: { ...page, id: "message" },
                      resource: { type: "message", id: "one", label: "Message one" },
                    },
                  },
                },
              ],
            },
          ],
        }),
      },
    },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "message",
    ref: { ...page, id: "message" },
    title: "Message",
    path: "messages/:resourceId",
    modeId: "project",
    parentId: "compose",
    resource: { kinds: [{ kind: "resource-kind", id: "message" }] },
    main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "compose" } },
    slots: [],
  });
  workbench.pageLocations.setProject("storybook-composer");
  workbench.pageLocations.navigate({ kind: "page", page });
  return workbench;
};

export const PageComposer: Story = {
  tags: ["!manifest", "page-composer-navigation"],
  args: { workbench: createComposerWorkbench() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const breadcrumb = within(canvas.getByRole("navigation", { name: "breadcrumb" }));
    await expect(breadcrumb.getByText("Messages", { exact: true })).toBeVisible();
    await expect(breadcrumb.getByText("New message", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Page actions" }));
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "Open message" }),
    );
    await expect(breadcrumb.getByText("Messages", { exact: true })).toBeVisible();
    await expect(await breadcrumb.findByText("Message one", { exact: true })).toBeVisible();
  },
};
