import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const fixture = (resource = false, rendererLabel?: string) => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({ id: "reader", title: "Message", body: { kind: "react", render: () => null } });
  const group = { kind: "page", extensionId: "example", id: "messages" } as const;
  const composer = { ...group, id: "compose" };
  workbench.pages.registerPage({
    id: group.id,
    ref: group,
    title: "Messages",
    icon: "messages-circle",
    path: "messages",
    modeId: "project",
    main: { kind: "group", default: composer },
    slots: [],
  });
  workbench.pages.registerPage({
    id: composer.id,
    ref: composer,
    title: "New message",
    icon: "message-circle",
    path: "messages/new",
    modeId: "project",
    parentId: group.id,
    main: {
      kind: "view",
      view: { kind: "view", id: "reader" },
      presentation: "page",
      cardinality: "one",
      tab: { getSnapshot: () => ({ label: "New message", icon: "message-circle" }) },
    },
    slots: [],
  });
  const page = { ...group, id: "message" };
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Message",
    path: "messages/view",
    modeId: "project",
    parentId: group.id,
    resource: { kinds: [{ kind: "resource-kind", id: "session", extensionId: "example" }] },
    main: {
      kind: "view",
      view: { kind: "view", id: "reader" },
      presentation: "page",
      cardinality: "one",
      tab: { getSnapshot: () => ({ label: rendererLabel, icon: rendererLabel ? "book-open" : undefined }) },
    },
    slots: [],
  });
  workbench.pageLocations.setProject("page-grouping-story");
  workbench.pageLocations.navigate(
    resource
      ? {
          kind: "page",
          page,
          resource: {
            type: "session",
            extensionId: "example",
            id: "one",
            label: rendererLabel ? undefined : "First message",
            icon: "message-circle",
            metadata: { status: "completed" },
          },
        }
      : { kind: "page", page: group },
  );
  return workbench;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Page grouping breadcrumbs",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
  tags: ["page-grouping"],
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;
const verify = async (canvasElement: HTMLElement, resourceIcon = "message-circle") => {
  const canvas = within(canvasElement);
  const breadcrumbs = within(canvas.getByRole("navigation", { name: "breadcrumb" }));
  await expect(breadcrumbs.getByText("Messages", { exact: true })).toBeVisible();
  await expect(breadcrumbs.queryByRole("button", { name: "Messages" })).toBeNull();
  await expect(breadcrumbs.queryByRole("link", { name: "Messages" })).toBeNull();
  await expect(canvasElement.querySelector("svg.lucide-messages-circle")).toBeVisible();
  await expect(canvasElement.querySelector(`svg.lucide-${resourceIcon}`)).toBeVisible();
};
export const Landing: Story = {
  args: { workbench: fixture() },
  play: async ({ canvasElement }) => verify(canvasElement),
};
export const SelectedResource: Story = {
  args: { workbench: fixture(true) },
  play: async ({ canvasElement }) => verify(canvasElement),
};
export const RendererLabel: Story = {
  args: { workbench: fixture(true, "Rendered message") },
  play: async ({ canvasElement }) => {
    await verify(canvasElement, "book-open");
    const breadcrumb = within(within(canvasElement).getByRole("navigation", { name: "breadcrumb" }));
    await expect(breadcrumb.getByText("Rendered message", { exact: true })).toBeVisible();
  },
};

export const BrowserParent: Story = {
  args: { workbench: browserFixture() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const breadcrumb = within(canvas.getByRole("navigation", { name: "breadcrumb" }));
    await userEvent.click(breadcrumb.getByRole("button", { name: "Library" }));
    await expect(await canvas.findByText("Browser content", { exact: true })).toBeVisible();
    await expect(breadcrumb.queryByRole("button", { name: "Library" })).toBeNull();
  },
};

function browserFixture() {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({
    id: "browser",
    title: "Library",
    body: { kind: "react", render: () => <div>Browser content</div> },
  });
  workbench.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  const root = { kind: "page", extensionId: "example", id: "library" } as const;
  const detail = { ...root, id: "document" };
  workbench.pages.registerPage({
    id: root.id,
    ref: root,
    title: "Library",
    path: "library",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "browser" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: detail.id,
    ref: detail,
    title: "Document",
    path: "document",
    modeId: "project",
    parentId: root.id,
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  workbench.pageLocations.setProject("browser-breadcrumb-story");
  workbench.pageLocations.navigate({
    kind: "page",
    page: detail,
    resource: { type: "document", id: "one", label: "First document" },
  });
  return workbench;
}
