import type { PageRef } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import { createWorkbench } from "../../workbench-core";

export const pageRef = (id: string) => ({ kind: "page", extensionId: "test", id }) satisfies PageRef;
export const modePanelFixture = (
  saved = new Map<string | undefined, WorkbenchLayout>(),
  scoped = true,
  extraPages: WorkbenchPageContribution[] = [],
  input: import("../../workbench-core-types").createWorkbenchInput = {},
) => {
  const w = createWorkbench({
    ...input,
    initialSidePanelMode: "closed",
    defaultPanelOpenByRegionId: { secondary: false },
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, structuredClone(layout)),
    },
    resolvePagePersistenceScope: scoped
      ? ({ currentScope, projectId, modeId, pageId, resource }) => ({
          scope: `${projectId}/${modeId}/${pageId}/${resource?.id ?? ""}`,
          carryRegions: currentScope?.startsWith(`${projectId}/${modeId}/`) ? ["side", "secondary"] : [],
        })
      : undefined,
  });
  w.views.registerView({ id: "document", title: "Document", body: { kind: "react", render: () => null } });
  for (const id of ["alpha", "beta", "bare"])
    w.modes.registerMode({ id, panels: id === "bare" ? [] : ["main", "side", "secondary"], activate() {} });
  for (const id of ["alpha", "alpha-list", "beta", "beta-list", "bare"])
    w.pages.registerPage({
      id,
      ref: pageRef(id),
      path: id,
      modeId: id.split("-")[0]!,
      main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
      slots: [],
    });
  w.pages.registerPage({
    id: "document",
    ref: pageRef("document"),
    path: "document",
    modeId: "alpha",
    parentId: "alpha",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "many" },
    slots: [],
  });
  for (const region of ["main", "side", "secondary"] as const)
    w.shellPlacements.registerPlacement({
      id: `shared-${region}`,
      region,
      item: {
        kind: "binding",
        binding: {
          view: { kind: "view", id: "document" },
          kinds: [{ kind: "resource-kind", id: "document" }],
          cardinality: "many",
        },
      },
    });
  const navigate = (id: string, resourceId?: string) =>
    w.pageLocations.navigate({
      kind: "page",
      page: pageRef(id),
      ...(resourceId ? { resource: { type: "document", id: resourceId } } : {}),
    });
  const open = (id: string, region: "main" | "side" | "secondary", retention: "pin" | "preview" = "preview") =>
    w.shellPlacements.openPlacement({
      placementId: `shared-${region}`,
      resource: { type: "document", id },
      open: retention,
    });
  const ids = (region: "main" | "side" | "secondary") =>
    w.layout.listPanelInstances(region).flatMap((tab) => tab.resource?.id ?? []);
  for (const page of extraPages) w.pages.registerPage(page);
  w.pageLocations.setProject("project");
  navigate("alpha");
  return { w, saved, navigate, open, ids };
};
