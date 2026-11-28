import { expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  createWorkbench,
  getWorkbenchRenderers,
  type TreeViewSection,
  type WorkbenchPanelInstance,
} from "../../../core";
import { toPanelInstance } from "../../../core/registries/layout/panel-api";
import { resolvePanelMenuRegionState } from "../../panel-menu/panel-menu-placements";
import { useTreePresentationState, useTreeViewState } from "./tree-presentation-state";
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
const filesWorkbench = (resourceMenu = false) => {
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
  w.viewMenus.registerViewMenu({
    id: "files.tree",
    ownerViewId: "file",
    viewId: "tree",
    side: "left",
    purpose: resourceMenu ? "resources" : undefined,
    config: resourceMenu ? { pageId: "files" } : undefined,
  });
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
    params: { focus: { type: "string" } },
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
  capture: (value: {
    activePageId?: string;
    activeNodeId: unknown;
    navigate: ReturnType<typeof createTreeNavigator>;
  }) => void;
}) => {
  const { workbench, placement } = props;
  const { activeLocation, activeResource, hostRegion, owner } = useTreeNavigationState(workbench, placement);
  const { body, childrenByNodeId } = useTreeData(workbench, "tree", placement.resource, placement.viewId);
  const activeNodeId = useTreeSelection(workbench, "tree", {
    sections: body,
    childrenByNodeId,
    activeLocation,
    activeResource,
    selectedNodeId: getWorkbenchRenderers(workbench).getTreeState("tree")?.selectedNodeId,
  });
  props.capture({
    activePageId: activeLocation?.page.id,
    activeNodeId,
    navigate: createTreeNavigator({ workbench, treeViewId: "tree", hostRegion, owner }),
  });
  return null;
};

for (const [region, params] of (["side", "secondary"] as const).flatMap((region) =>
  [undefined, { focus: "special" }].map((params) => [region, params] as const),
))
  test(`a ${region} Files tab reuses documents unless page params are explicit: ${Boolean(params)}`, async () => {
    const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    const w = filesWorkbench();
    let renderer: ReactTestRenderer | undefined;
    try {
      await w.navigation.openTarget({ kind: "page", page: page("files"), resource: file("src/app.ts") });
      w.movePanel(w.pages.getContent()!.widgetId, region);
      let tree: Parameters<Parameters<typeof MenuTree>[0]["capture"]>[0] | undefined;
      const originalMenu = w.layout.getLayout().regions[`${region}-left-menu`].widgets[0]!;
      const originalMenuId = originalMenu.widgetId;
      const render = async (menuId = originalMenuId) => {
        const menu = w.layout
          .getLayout()
          .regions[`${region}-left-menu`].widgets.find((item) => item.widgetId === menuId)!;
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
          intent: {
            id: "target",
            payload: { kind: "page", page: page("files"), resource: file("src/other.ts"), params },
          },
        }),
      );
      const layout = w.layout.getLayout();
      expect(layout.regions[region].widgets.map((entry) => entry.resource?.metadata?.path)).toEqual(
        params ? ["src/other.ts", "src/app.ts"] : ["src/other.ts"],
      );
      expect(layout.regions[region].widgets[0]?.pageContext?.params).toEqual(params);
      expect(layout.regions.main.widgets).toEqual([]);
      expect(w.pages.store.getState().location?.page).toEqual(page("home"));
      await render();
      expect(tree?.activeNodeId).toBe(params ? "src/app.ts" : "src/other.ts");
      if (params) {
        const menus = w.layout.getLayout().regions[`${region}-left-menu`];
        const activeMenu = menus.widgets.find((item) => item.widgetId === menus.activeWidgetId)!;
        expect(activeMenu.menuOwnerWidgetId).toBe(layout.regions[region].activeWidgetId);
        expect(resolvePanelMenuRegionState(w, `${region}-left-menu`).widgets.map((item) => item.widgetId)).toEqual([
          activeMenu.widgetId,
        ]);
        expect(activeMenu.resource?.metadata?.path).toBe("src/other.ts");
        await render(activeMenu.widgetId);
        expect(tree?.activeNodeId).toBe("src/other.ts");
        await act(async () => {
          w.layout.activatePanel(originalMenu.menuOwnerWidgetId!);
        });
        expect(resolvePanelMenuRegionState(w, `${region}-left-menu`).widgets.map((item) => item.widgetId)).toEqual([
          originalMenuId,
        ]);
        await render();
        expect(tree?.activeNodeId).toBe("src/app.ts");
      }
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
  expect(resolveTreeHostRegion(layout, menu!.widgetId)).toBe("main-left-menu");
  await w.dispose();
});

test("a resource tree in another page's preview uses its semantic resource page", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const w = filesWorkbench(true);
  w.layout.registerPanel({
    id: "timeline-preview",
    title: "Preview",
    rendererId: "file",
    region: "side",
    panelMenus: w.viewMenus.definitionsFor("file", "timeline-preview"),
  });
  w.layout.openWidget("timeline-preview", {
    viewId: "file",
    resource: file("src/app.ts"),
    pageContext: { page: page("home") },
  });
  const menu = w.layout.getLayout().regions["side-left-menu"].widgets[0]!;
  let result: Parameters<Parameters<typeof MenuTree>[0]["capture"]>[0] | undefined;
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(
        <MenuTree
          workbench={w}
          placement={toPanelInstance(menu)}
          capture={(value) => {
            result = value;
          }}
        />,
      );
    });
    expect(result?.activePageId).toBe("files");
    expect(w.pages.store.getState().location?.page).toEqual(page("home"));
  } finally {
    await act(async () => renderer?.unmount());
    await w.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("a new resource tree scope displays declared node defaults without default sections", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const w = createWorkbench();
  w.views.registerView({
    id: "default-tree",
    title: "Files",
    body: { kind: "tree", defaultExpandedNodeIds: ["src"], getBody: () => [], getChildren: () => [] },
  });
  let expanded: string[] = [];
  const Probe = () => {
    expanded = useTreeViewState(w, "default-tree", file("src/app.ts"), undefined, false).treeState.expandedNodeIds;
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(expanded).toEqual(["src"]);
  } finally {
    await act(async () => renderer?.unmount());
    await w.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("resource navigation presentation survives transfer from project navigation to a tab menu", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const w = filesWorkbench(true);
  w.views.registerView({
    id: "project-tree",
    title: "Project navigation",
    body: { kind: "tree", getBody: () => [], getChildren: () => [] },
  });
  w.navigationTrees.registerContribution({
    id: "files.nav",
    owner: { kind: "page", id: "files", extensionId: "example" },
    sourceExtensionId: "example",
    declarationIndex: 0,
    viewId: "tree",
  });
  await w.navigation.openTarget({ kind: "page", page: page("files"), resource: file("src/app.ts") });
  let current!: ReturnType<typeof useTreeViewState>;
  const Probe = (props: { placement?: WorkbenchPanelInstance }) => {
    current = useTreeViewState(
      w,
      props.placement ? "tree" : "project-tree",
      props.placement?.resource,
      props.placement,
      !props.placement,
    );
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<Probe />);
    });
    const scope = current.stateScope;
    expect(scope).toBeDefined();
    await act(async () => {
      getWorkbenchRenderers(w).setNodeExpanded("project-tree", "src", true, scope);
      getWorkbenchRenderers(w).setSelectedNode("project-tree", "src/app.ts", scope);
      current.presentation.update({ filter: "app", scrollTop: 120 });
    });
    await act(async () => {
      renderer!.unmount();
      await w.movePanel(w.pages.getContent()!.widgetId, "side");
    });
    const menu = w.layout.getLayout().regions["side-left-menu"].widgets[0]!;
    await act(async () => {
      renderer = create(<Probe placement={toPanelInstance(menu)} />);
    });
    expect(current.stateScope).toBe(scope);
    expect(current.treeState).toMatchObject({ expandedNodeIds: ["src"], selectedNodeId: "src/app.ts" });
    expect(current.presentation).toMatchObject({ filter: "app", scrollTop: 120 });
    expect(w.pages.store.getState().location?.page).toEqual(page("home"));
  } finally {
    await act(async () => renderer?.unmount());
    await w.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("a resource-scoped navigation tree reflects the host's loading state", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const w = filesWorkbench(true);
  let current!: ReturnType<typeof useTreeViewState>;
  const Probe = () => {
    current = useTreeViewState(w, "tree", file("src/app.ts"), undefined, true);
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(current.stateScope).toBeDefined();
    await act(async () => w.treeViews.setLoading("tree", true));
    expect(current.treeState.loading).toBe(true);
    await act(async () => w.treeViews.setLoading("tree", false));
    expect(current.treeState.loading).toBe(false);
  } finally {
    await act(async () => renderer?.unmount());
    await w.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("tree presentation keeps live drafts while expiring old closed-resource filters", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const w = filesWorkbench();
  let live!: ReturnType<typeof useTreePresentationState>, history!: ReturnType<typeof useTreePresentationState>;
  const Probe = ({ id, active = false }: { id: string; active?: boolean }) => {
    const value = useTreePresentationState(w, id);
    if (active) live = value;
    else history = value;
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(
        <>
          <Probe id="live" active />
          <Probe id="old" />
        </>,
      );
    });
    await act(async () => {
      live.update({ filter: "keep live", scrollTop: 120 });
      history.update({ filter: "old closed" });
    });
    for (let i = 0; i < 300; i++) {
      await act(async () =>
        renderer!.update(
          <>
            <Probe id="live" active />
            <Probe id={`closed-${i}`} />
          </>,
        ),
      );
      await act(async () => history.update({ filter: `filter-${i}` }));
    }
    expect(live).toMatchObject({ filter: "keep live", scrollTop: 120 });
    await act(async () =>
      renderer!.update(
        <>
          <Probe id="live" active />
          <Probe id="closed-298" />
        </>,
      ),
    );
    expect(history.filter).toBe("filter-298");
    await act(async () =>
      renderer!.update(
        <>
          <Probe id="live" active />
          <Probe id="old" />
        </>,
      ),
    );
    expect(history.filter).toBe("");
  } finally {
    await act(async () => renderer?.unmount());
    await w.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
