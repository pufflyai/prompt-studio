import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";
import type { PersistedWorkbenchPageLocation } from "../page-location/page-location-types";

export const viewerPage = (id: string) => ({ kind: "page" as const, extensionId: "example.readers", id });
export const viewerPanel = { kind: "placement" as const, extensionId: "example.readers", id: "reader" };
export const viewerResource = (id: string, type = "record"): ResourceRef => ({
  type,
  id,
  extensionId: "example.readers",
  projectId: "project",
  label: id,
});
export const createResourceViewerFixture = (
  options: {
    tabs?: boolean;
    document?: boolean;
    saved?: Map<string | undefined, WorkbenchLayout>;
    locations?: Map<string, PersistedWorkbenchPageLocation>;
    sideCanOpen?: boolean;
    collection?: boolean;
  } = {},
) => {
  const saved = options.saved ?? new Map<string | undefined, WorkbenchLayout>();
  const locations = options.locations ?? new Map<string, PersistedWorkbenchPageLocation>();
  const w = createWorkbench({
    ...(options.sideCanOpen === false ? { defaultPanelOpenByRegionId: { side: true } } : {}),
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, structuredClone(layout)),
      listLayouts: () => [...saved].map(([scope, layout]) => ({ scope, layout })),
    },
    pageLocationPersistence: {
      load: (project) => locations.get(project),
      save: (project, location) => locations.set(project, location),
    },
  });
  w.modes.registerMode({ id: "project", activate() {}, regionSettings: { side: { canOpen: options.sideCanOpen } } });
  for (const id of ["reader", "landing", "browser"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  const kinds = ["record", "draft"].map((id) => ({
    kind: "resource-kind" as const,
    extensionId: "example.readers",
    id,
  }));
  w.modePlacements.registerPlacement({
    id: "reader",
    ref: viewerPanel,
    modeId: "project",
    region: options.collection ? "main" : "side",
    item: { kind: "binding", binding: { kinds, view: { kind: "view", id: "reader" }, cardinality: "many" } },
  });
  w.pages.registerPage({
    id: "home",
    ref: viewerPage("home"),
    title: "Home",
    path: "",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  w.pages.registerPage({
    id: "reader",
    ref: viewerPage("reader"),
    title: "Reader",
    path: "reader",
    modeId: "project",
    parentId: "home",
    resource: { kinds },
    ...(options.document ? { document: { metadataKey: "document" } } : {}),
    panelView: viewerPanel,
    main: options.collection
      ? { kind: "panels", landing: viewerPanel }
      : {
          kind: "view",
          presentation: options.tabs ? "tabs" : "page",
          cardinality: "many",
          view: { kind: "view", id: "reader" },
          empty: { kind: "view", id: "landing" },
        },
    slots: [],
  });
  w.pages.registerPage({
    id: "other",
    ref: viewerPage("other"),
    path: "other",
    modeId: "project",
    main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "browser" } },
    slots: [],
  });
  w.pageLocations.setProject("project");
  w.pageLocations.navigate({ kind: "page", page: viewerPage("home") });
  const openMain = (id: string, type = "record") =>
    w.navigation.openPage({ page: viewerPage("reader"), resource: viewerResource(id, type), open: "pin" });
  const openSide = (id: string, type = "record") =>
    w.navigation.openPanel({ panel: viewerPanel, resource: viewerResource(id, type), region: "side", open: "pin" });
  const other = () => w.pageLocations.navigate({ kind: "page", page: viewerPage("other") });
  const side = () => w.layout.getActivePanel("side")!;
  return { w, saved, locations, openMain, openSide, other, side };
};
