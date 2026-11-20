import { expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  createWorkbench,
  getWorkbenchRenderers,
  type TreeViewSection,
  type WorkbenchPanelInstance,
} from "../../../core";
import { toPanelInstance } from "../../../core/registries/layout/panel-api";
import { createTreeNavigator } from "./tree-view";
import { useTreeData } from "./use-tree-data";
import { resolveTreeHostRegion, useTreeNavigationState } from "./use-tree-navigation-state";
import { useTreeSelection } from "./use-tree-selection";

const page = (id: string) => ({ kind: "page" as const, extensionId: "example", id });
const kind = { kind: "resource-kind" as const, extensionId: "example", id: "workspace" };
const file = (path: string) => ({
  type: "workspace",
  id: "project-folder",
  extensionId: "example",
  metadata: { path },
});

// A Files page like pstdio.workspaces: its file view owns a Files tree menu whose rows target documents.
const filesWorkbench = () => {
  const w = createWorkbench({ initialSidePanelMode: "attached" });
  w.modes.registerMode({ id: "project", activate() {} });
  for (const id of ["file", "home"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  w.views.registerView({
    id: "tree",
    title: "Files",
    body: {
      kind: "tree",
      getReadKey: (ctx) => String(ctx.resource?.metadata?.path),
      getBody: (ctx): TreeViewSection[] => [
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
                selected: ctx.resource?.metadata?.path === path,
                target: { kind: "page" as const, page: page("files"), resource: file(path) },
              })),
            },
          ],
        },
      ],
      getChildren: () => [],
    },
  });
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

// The selection and row navigation WorkbenchTreeView composes, without its DOM-only chrome.
const MenuTree = (props: {
  workbench: ReturnType<typeof filesWorkbench>;
  placement: WorkbenchPanelInstance;
  capture: (value: { activeNodeId: unknown; navigate: ReturnType<typeof createTreeNavigator> }) => void;
}) => {
  const { workbench, placement } = props;
  const { activeLocation, activeResource, hostRegion } = useTreeNavigationState(workbench, placement);
  const { body, childrenByNodeId } = useTreeData(workbench, "tree", placement.resource, placement.viewId);
  const activeNodeId = useTreeSelection(workbench, "tree", {
    sections: body,
    childrenByNodeId,
    activeLocation,
    activeResource,
    selectedNodeId: getWorkbenchRenderers(workbench).getTreeState("tree")?.selectedNodeId,
  });
  props.capture({ activeNodeId, navigate: createTreeNavigator({ workbench, treeViewId: "tree", hostRegion }) });
  return null;
};

for (const region of ["side", "secondary"] as const)
  test(`a ${region} preview's Files menu selects its document and opens rows in the same panel`, async () => {
    const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    const w = filesWorkbench();
    let renderer: ReactTestRenderer | undefined;
    try {
      await w.navigation.openTarget({ kind: "page", page: page("files"), resource: file("src/app.ts"), region });
      let tree: Parameters<Parameters<typeof MenuTree>[0]["capture"]>[0] | undefined;
      const render = async () => {
        const menu = w.layout.getLayout().regions[`${region}-left-menu`].widgets[0]!;
        const element = (
          <MenuTree workbench={w} placement={toPanelInstance(menu)} capture={(value) => (tree = value)} />
        );
        await act(async () => {
          if (renderer) renderer.update(element);
          else renderer = create(element);
        });
      };
      await render();
      // Main still routes home; the menu follows the previewed document and reveals it.
      expect(w.pages.store.getState().location?.page).toEqual(page("home"));
      expect(tree?.activeNodeId).toBe("src/app.ts");
      expect(getWorkbenchRenderers(w).getTreeState("tree")?.expandedNodeIds).toContain("src");
      await act(async () =>
        tree!.navigate({
          nodeId: "src/other.ts",
          intent: { id: "target", payload: { kind: "page", page: page("files"), resource: file("src/other.ts") } },
        }),
      );
      const layout = w.layout.getLayout();
      expect(layout.regions[region].widgets.map((entry) => entry.resource?.metadata?.path)).toEqual(["src/other.ts"]);
      expect(layout.regions.main.widgets).toEqual([]);
      expect(w.pages.store.getState().location?.page).toEqual(page("home"));
      await render();
      expect(tree?.activeNodeId).toBe("src/other.ts");
    } finally {
      await act(async () => renderer?.unmount());
      await w.dispose();
      environment.IS_REACT_ACT_ENVIRONMENT = previous;
    }
  });

test("a Files menu on a page in Main keeps the routed location", async () => {
  const w = filesWorkbench();
  await w.navigation.openTarget({ kind: "page", page: page("files"), resource: file("src/app.ts") });
  const layout = w.layout.getLayout();
  const menu = layout.regions["main-left-menu"].widgets[0];
  expect(menu).toBeDefined();
  expect(resolveTreeHostRegion(layout, menu!.widgetId)).toBeUndefined();
  await w.dispose();
});
