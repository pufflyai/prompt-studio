import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";

test("collection history selects the routed resource in its existing viewer", () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const w = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, structuredClone(layout)),
    },
    resolvePagePersistenceScope: ({ projectId, modeId, pageId, resource }) => ({
      scope: `${projectId}/${modeId}/${pageId}/${resource?.id ?? ""}`,
    }),
  });
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({ id: "document", title: "Document", body: { kind: "react", render: () => null } });
  const viewer = { kind: "placement", extensionId: "example", id: "documents" } as const;
  w.modePlacements.registerPlacement({
    id: "documents",
    ref: viewer,
    modeId: "project",
    region: "main",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "document" }],
        view: { kind: "view", id: "document" },
        cardinality: "many",
      },
    },
  });
  const collection = { kind: "page", extensionId: "example", id: "documents" } as const;
  w.pages.registerPage({
    id: "documents",
    ref: collection,
    path: "documents",
    modeId: "project",
    main: { kind: "panels" },
    panelView: viewer,
    slots: [],
  });
  const page = { kind: "page", extensionId: "example", id: "document" } as const;
  w.pages.registerPage({
    id: "document",
    ref: page,
    path: "documents/view",
    modeId: "project",
    parentId: "documents",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "panels", landing: viewer },
    slots: [],
  });
  w.pageLocations.setProject("project");
  const navigate = (id: string, open?: "pin") =>
    w.pageLocations.navigate({
      kind: "page",
      page,
      resource: { type: "document", id },
      open,
    });
  expect(navigate("first").ok).toBe(true);
  const first = w.layout.getActivePanel("main")!.instanceId;
  expect(navigate("second", "pin").ok).toBe(true);
  const second = w.layout.getActivePanel("main")!.instanceId;
  w.pageLocations.goBack();
  expect(w.pages.store.getState().location?.resource?.id).toBe("first");
  expect(w.layout.getActivePanel("main")?.instanceId).toBe(first);
  w.pageLocations.goForward();
  expect(w.layout.getActivePanel("main")?.instanceId).toBe(second);
  expect(w.layout.listPanelInstances("main")).toHaveLength(2);
});
