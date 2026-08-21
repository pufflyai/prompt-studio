import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { describeResourceRouteContract, type RouteContractHarness } from "@pstdio/workbench/testing";
import { getDashboardActiveCollection, getDashboardSelectedResource } from "@/shared/app/navigation-state";
import { selectDashboardProject } from "@/shared/app/project-context";
import { registerResourceRoute } from "./route-helper";

const ROOT = {
  kind: "dashboard-view",
  uri: "dashboard-workbench://route-test",
  id: "workspaces",
  label: "Route test",
};
const DETAIL_KIND = "route-test-detail";
const MODE = "route-test-mode";

// Builds a real workbench whose only route is produced by registerResourceRoute, then runs the
// shared navigation contract against it. This proves the helper emits a contract-compliant route.
const setup = (): RouteContractHarness => {
  const workbench = createWorkbenchCore();
  selectDashboardProject(workbench, { id: "project-1", name: "Route test" });
  workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
  workbench.resources.registerKind({ kind: DETAIL_KIND, label: "Detail" });

  workbench.registerModule({
    id: "route-test.module",
    activate(ctx) {
      ctx.modes.registerMode({ id: MODE, label: "Route test", activate: () => undefined });
      ctx.layout.registerPanel({
        id: "route-test-root",
        title: "Root",
        region: "main",
        singleton: true,
        rendererId: "noop",
        resourceKinds: ["dashboard-view"],
      });
      ctx.layout.registerPanel({
        id: "route-test-detail",
        title: "Detail",
        region: "main",
        singleton: true,
        rendererId: "noop",
        resourceKinds: [DETAIL_KIND],
      });
      registerResourceRoute(ctx, {
        id: "route-test.root",
        match: (resource) => resource.uri === ROOT.uri,
        mode: MODE,
        panelId: "route-test-root",
      });
      registerResourceRoute(ctx, {
        id: "route-test.detail",
        match: (resource) => resource.kind === DETAIL_KIND,
        mode: MODE,
        panelId: "route-test-detail",
      });
      return undefined;
    },
  });

  return { workbench };
};

describeResourceRouteContract({
  name: "route-helper",
  setup,
  root: ROOT,
  detail: { kind: DETAIL_KIND, uri: "route-test://detail/1", id: "1", label: "Detail 1" },
  detailB: { kind: DETAIL_KIND, uri: "route-test://detail/2", id: "2", label: "Detail 2" },
  rootDetailHistory: "replaced",
  expectedMode: MODE,
});

describe("registerResourceRoute navigation state", () => {
  test("keeps aggregate collections separate from selected resources", async () => {
    const { workbench } = setup();
    const detail = { kind: DETAIL_KIND, uri: "route-test://detail/1", id: "1", label: "Detail 1" };

    await workbench.resources.openResource(ROOT);

    expect(getDashboardActiveCollection(workbench)).toBe("workspaces");
    expect(getDashboardSelectedResource(workbench)).toBeUndefined();

    await workbench.resources.openResource(detail, { replaceActive: true });

    expect(getDashboardActiveCollection(workbench)).toBeUndefined();
    expect(getDashboardSelectedResource(workbench)).toEqual(detail);
  });

  test("selects the resource before seeding its mode scope", async () => {
    const workbench = createWorkbenchCore();
    const activationScopes: Array<string | undefined> = [];
    selectDashboardProject(workbench, { id: "project-1", name: "Route test" });
    workbench.resources.registerKind({ kind: DETAIL_KIND, label: "Detail" });
    workbench.modes.registerMode({
      id: MODE,
      panels: ["main"],
      activate: () => undefined,
      seed: () => {
        activationScopes.push(workbench.layout.getPersistenceScope());
      },
    });
    workbench.layout.registerPanel({
      id: "route-test-detail",
      title: "Detail",
      region: "main",
      rendererId: "noop",
      resourceKinds: [DETAIL_KIND],
    });
    registerResourceRoute(workbench, {
      id: "route-test.detail",
      match: (resource) => resource.kind === DETAIL_KIND,
      mode: MODE,
      panelId: "route-test-detail",
    });

    await workbench.resources.openResource({
      kind: DETAIL_KIND,
      uri: "route-test://detail/1",
      id: "1",
    });

    expect(activationScopes).toEqual(["project/project-1/mode/route-test-mode/resource/route-test://detail/1"]);
  });

  test("restores independent resource layouts across A to B to A navigation", async () => {
    const layouts = new Map<string | undefined, ReturnType<typeof workbenchLayout>>();
    const panels = new Map<string | undefined, { openByRegionId: Record<string, boolean> }>();
    const workbench = createWorkbenchCore({
      layoutPersistence: {
        getLayout: (scope) => layouts.get(scope),
        setLayout: (layout, scope) => layouts.set(scope, structuredClone(layout)),
      },
      panelsPersistence: {
        getPanelStates: (scope) => panels.get(scope),
        setPanelStates: (state, scope) => panels.set(scope, structuredClone(state)),
      },
    });
    selectDashboardProject(workbench, { id: "project-1", name: "Route test" });
    workbench.resources.registerKind({ kind: DETAIL_KIND, label: "Detail" });
    workbench.modes.registerMode({ id: MODE, activate: () => undefined });
    workbench.layout.registerPanel({
      id: "route-test-detail",
      title: "Detail",
      region: "main",
      rendererId: "noop",
      resourceKinds: [DETAIL_KIND],
    });
    registerResourceRoute(workbench, {
      id: "route-test.detail",
      match: (resource) => resource.kind === DETAIL_KIND,
      mode: MODE,
      panelId: "route-test-detail",
    });
    const resourceA = { kind: DETAIL_KIND, uri: "route-test://detail/a", id: "a" };
    const resourceB = { kind: DETAIL_KIND, uri: "route-test://detail/b", id: "b" };

    await workbench.resources.openResource(resourceA);
    workbench.layout.setRegionSize("main", 500);
    workbench.layout.setRegionVisible("secondary", false);
    workbench.panels.setOpen("secondary", false);

    await workbench.resources.openResource(resourceB, { replaceActive: true });
    expect(workbench.layout.getLayout().regions.main.size).toBeUndefined();
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(true);
    workbench.layout.setRegionSize("main", 700);

    await workbench.resources.openResource(resourceA, { replaceActive: true });
    expect(workbench.layout.getLayout().regions.main.size).toBe(500);
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(false);
    expect(workbench.panels.isOpen("secondary")).toBe(false);

    await workbench.resources.openResource(resourceB, { replaceActive: true });
    expect(workbench.layout.getLayout().regions.main.size).toBe(700);
  });
});

const workbenchLayout = () => createWorkbenchCore().layout.getLayout();
