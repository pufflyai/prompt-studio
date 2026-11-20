import { expect, test } from "bun:test";
import { createWorkbench, type TreeViewSection } from "../../../core";
import { resolveTreeListSelection } from "./tree-list-selection";
import { resolveSidePanelTreePlacement } from "./use-tree-navigation-state";

const page = (id: string) => ({ kind: "page" as const, extensionId: "example", id });
const kind = { kind: "resource-kind" as const, extensionId: "example", id: "workspace" };
const workspace = { type: "workspace", id: "project-folder", extensionId: "example" };
const file = (path: string) => ({ ...workspace, metadata: { path } });

const filesWorkbench = () => {
  const w = createWorkbench({ initialSidePanelMode: "attached" });
  w.modes.registerMode({ id: "project", activate() {} });
  for (const id of ["file", "tree", "home"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  w.viewMenus.registerViewMenu({ id: "files.tree", ownerViewId: "file", viewId: "tree", side: "left" });
  w.pages.registerPage({
    id: "home",
    ref: page("home"),
    path: "",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "home" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  w.pages.registerPage({
    id: "files",
    ref: page("files"),
    path: "files",
    modeId: "project",
    parentId: "home",
    resource: { kinds: [kind] },
    document: { metadataKey: "path" },
    main: { kind: "view", view: { kind: "view", id: "file" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  w.pageLocations.setProject("project");
  w.pageLocations.navigate({ kind: "page", page: page("home") });
  return w;
};

const fileTree = (selected: string): TreeViewSection[] => [
  {
    id: "files",
    nodes: [
      {
        id: "src",
        label: "src",
        collapsible: true,
        children: ["src/app.ts", "src/other.ts"].map((path) => ({
          id: path,
          label: path.slice(4),
          selected: path === selected,
          target: { kind: "page" as const, page: page("files"), resource: file(path) },
        })),
      },
    ],
  },
];

test("a Files menu in the Side preview selects the previewed document, not the routed Main page", async () => {
  const w = filesWorkbench();
  await w.navigation.openTarget({
    kind: "page",
    page: page("files"),
    resource: file("src/app.ts"),
    region: "side",
    open: "preview",
  });
  const layout = w.layout.getLayout();
  const menu = layout.regions["side-left-menu"].widgets[0];
  const side = resolveSidePanelTreePlacement(layout, menu.widgetId);
  expect(side?.pageContext?.page).toEqual(page("files"));
  expect(side?.resource?.metadata).toEqual({ path: "src/app.ts" });
  const resourceReferenceKey = (resource: Parameters<typeof w.pages.resourceReferenceKey>[0]) =>
    w.pages.resourceReferenceKey(resource);
  const select = (activeLocation: Parameters<typeof resolveTreeListSelection>[0]["activeLocation"]) =>
    resolveTreeListSelection({
      sections: fileTree("src/app.ts"),
      childrenByNodeId: {},
      activeLocation,
      activeResource: activeLocation?.resource,
      resourceReferenceKey,
    });
  expect(select({ ...side!.pageContext!, resource: side!.resource })).toBe("src/app.ts");
  // Main still routes the home page, which does not own the previewed document.
  expect(select(w.pages.store.getState().location)).toBeUndefined();
});

test("trees outside the Side Panel keep the routed Main location", async () => {
  const w = filesWorkbench();
  await w.navigation.openTarget({ kind: "page", page: page("files"), resource: file("src/app.ts") });
  const layout = w.layout.getLayout();
  const menu = layout.regions["main-left-menu"].widgets[0];
  expect(menu).toBeDefined();
  expect(resolveSidePanelTreePlacement(layout, menu.widgetId)).toBeUndefined();
});
