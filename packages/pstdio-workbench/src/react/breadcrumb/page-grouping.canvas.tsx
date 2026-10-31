import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
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
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Landing: Story = {
  id: "pstdio-workbench-reference-core-api-page-grouping-breadcrumbs--landing",
  args: { workbench: fixture() },
};
export const SelectedResource: Story = {
  id: "pstdio-workbench-reference-core-api-page-grouping-breadcrumbs--selected-resource",
  args: { workbench: fixture(true) },
};
export const RendererLabel: Story = {
  id: "pstdio-workbench-reference-core-api-page-grouping-breadcrumbs--renderer-label",
  args: { workbench: fixture(true, "Rendered message") },
};
export const BrowserParent: Story = {
  id: "pstdio-workbench-reference-core-api-page-grouping-breadcrumbs--browser-parent",
  args: { workbench: browserFixture() },
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
