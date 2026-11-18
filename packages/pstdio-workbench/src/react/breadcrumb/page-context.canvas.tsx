import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createPageContextWorkbench = (routed = false, contextView = false) => {
  const page = { kind: "page" as const, extensionId: "preview", id: "documents" };
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
  workbench.pageLocations.setProject("preview-context");
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
  title: "Product/Workbench/Navigation/Breadcrumbs/Page context",
  component: WorkbenchStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const CollectionDocument: Story = {
  id: "pstdio-workbench-guides-page-context--collection-document",
  args: { workbench: createPageContextWorkbench() },
};
export const RoutedResource: Story = {
  id: "pstdio-workbench-guides-page-context--routed-resource",
  args: { workbench: createPageContextWorkbench(true) },
};
export const RoutedContextView: Story = {
  id: "pstdio-workbench-guides-page-context--routed-context-view",
  args: { workbench: createPageContextWorkbench(true, true) },
};
const createComposerWorkbench = () => {
  const workbench = createWorkbench();
  const page = { kind: "page" as const, extensionId: "preview", id: "compose" };
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
  workbench.pageLocations.setProject("preview-composer");
  workbench.pageLocations.navigate({ kind: "page", page });
  return workbench;
};
export const PageComposer: Story = {
  id: "pstdio-workbench-guides-page-context--page-composer",
  args: { workbench: createComposerWorkbench() },
};

const createSessionWorkbench = () => {
  const page = { kind: "page" as const, extensionId: "preview", id: "conversation" };
  const workbench = createWorkbench({ startPage: page });
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({ id: page.id, title: "Conversation", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "sessions",
    ref: { ...page, id: "sessions" },
    title: "Sessions",
    path: "sessions",
    modeId: "project",
    main: { kind: "group", default: page },
    slots: [],
  });
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Conversation",
    path: "conversation",
    modeId: "project",
    parentId: "sessions",
    resource: { kinds: [{ kind: "resource-kind", id: "session" }] },
    main: {
      kind: "view",
      presentation: "page",
      cardinality: "one",
      view: { kind: "view", id: page.id },
      tab: {
        getSnapshot: () => ({
          indicator: { icon: "loader-circle", color: "fg.info", label: "Session status: in_progress" },
        }),
      },
    },
    slots: [],
  });
  workbench.pageLocations.setProject("preview-session");
  workbench.pageLocations.navigate({
    kind: "page",
    page,
    resource: { type: "session", id: "logs", label: "Investigate logs", icon: "message-circle" },
  });
  return workbench;
};

export const SessionStatus: Story = {
  id: "pstdio-workbench-guides-page-context--session-status",
  args: { workbench: createSessionWorkbench() },
};
