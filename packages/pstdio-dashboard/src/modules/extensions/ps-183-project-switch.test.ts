import { describe, expect, mock, test } from "bun:test";
import type {
  WorkbenchExtensionMetadata as DashboardExtensionMetadata,
  ListExtensionAppearanceResponse,
} from "@pstdio/sdk/api";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  clearCachedDashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadataWithResourceExtension } from "./module-test-fixtures";

interface Deferred<TValue> {
  promise: Promise<TValue>;
  resolve: (value: TValue) => void;
}

const deferred = <TValue>(): Deferred<TValue> => {
  let resolve: ((value: TValue) => void) | undefined;
  const promise = new Promise<TValue>((nextResolve) => {
    resolve = nextResolve;
  });
  return {
    promise,
    resolve: (value) => resolve?.(value),
  };
};

const createBaselineHarness = () => {
  const metadataRequests = new Map<string, Deferred<DashboardExtensionMetadata>>();
  const appearanceRequests = new Map<string, Deferred<ListExtensionAppearanceResponse>>();
  const loadMetadata = mock((projectId: string) => {
    const request = deferred<DashboardExtensionMetadata>();
    metadataRequests.set(projectId, request);
    return request.promise;
  });
  const loadAppearance = mock((projectId: string) => {
    const request = deferred<ListExtensionAppearanceResponse>();
    appearanceRequests.set(projectId, request);
    return request.promise;
  });
  const workbench = createWorkbenchCore();

  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.dashboardSidenav,
    title: "Sidenav",
    getBody: () => [],
    getChildren: () => [],
  });

  const contributionApplications: string[] = [];
  const unsubscribeResources = workbench.resources.store.subscribe((state, previous) => {
    for (const providerId of Object.keys(state.hierarchyProviders)) {
      if (providerId in previous.hierarchyProviders) continue;
      if (!providerId.startsWith("dashboard.extensions.resource-hierarchy.")) continue;
      contributionApplications.push(providerId);
    }
  });
  const sidenavRefreshes: string[] = [];
  const refreshSubscription = workbench.renderers.onDidRefresh((event) => {
    if (event.treeId === dashboardWidgetIds.dashboardSidenav) sidenavRefreshes.push(event.treeId);
  });
  const settingsRefreshes: number[] = [];
  const settingsSubscription = workbench.settings.store.subscribe((state, previous) => {
    if (state.revision !== previous.revision) settingsRefreshes.push(state.revision);
  });

  selectDashboardProject(workbench, { id: "project-a", name: "Project A" });
  const moduleDisposable = workbench.registerModule(createExtensionsModule({ loadAppearance, loadMetadata }));

  const settleProject = async (projectId: string, order: "metadata-first" | "appearance-first") => {
    const metadataRequest = metadataRequests.get(projectId);
    const appearanceRequest = appearanceRequests.get(projectId);
    expect(metadataRequest).toBeDefined();
    expect(appearanceRequest).toBeDefined();

    if (order === "metadata-first") {
      metadataRequest?.resolve(metadataWithResourceExtension);
      await flushMicrotasks();
      appearanceRequest?.resolve(emptyAppearance);
    } else {
      appearanceRequest?.resolve(emptyAppearance);
      await flushMicrotasks();
      metadataRequest?.resolve(metadataWithResourceExtension);
    }
    await flushMicrotasks();
    await flushMicrotasks();
  };

  const resetCounts = () => {
    contributionApplications.length = 0;
    sidenavRefreshes.length = 0;
    settingsRefreshes.length = 0;
    loadAppearance.mockClear();
    loadMetadata.mockClear();
  };

  const dispose = () => {
    moduleDisposable.dispose();
    refreshSubscription.dispose();
    settingsSubscription();
    unsubscribeResources();
    for (const projectId of ["project-a", "project-b", "project-c"]) {
      clearCachedDashboardExtensionMetadata(projectId);
    }
  };

  return {
    appearanceRequests,
    contributionApplications,
    dispose,
    loadAppearance,
    loadMetadata,
    metadataRequests,
    resetCounts,
    settleProject,
    settingsRefreshes,
    sidenavRefreshes,
    workbench,
  };
};

describe("PS-183 project-switch extension refresh", () => {
  for (const order of ["metadata-first", "appearance-first"] as const) {
    test(`applies switched-project contributions once when ${order}`, async () => {
      const harness = createBaselineHarness();

      try {
        await harness.settleProject("project-a", "metadata-first");
        harness.resetCounts();

        selectDashboardProject(harness.workbench, { id: "project-b", name: "Project B" });
        await harness.settleProject("project-b", order);

        expect(harness.loadMetadata).toHaveBeenCalledTimes(1);
        expect(harness.loadAppearance).toHaveBeenCalledTimes(1);
        expect(harness.contributionApplications).toHaveLength(1);
        expect(harness.contributionApplications.every((id) => id.includes("project-b"))).toBe(true);
        expect(harness.sidenavRefreshes).toHaveLength(1);
        expect(harness.settingsRefreshes.length).toBeGreaterThan(0);
      } finally {
        harness.dispose();
      }
    });
  }

  test("rejects stale metadata and appearance completions after another project wins", async () => {
    const harness = createBaselineHarness();

    try {
      await harness.settleProject("project-a", "metadata-first");
      harness.resetCounts();

      selectDashboardProject(harness.workbench, { id: "project-b", name: "Project B" });
      selectDashboardProject(harness.workbench, { id: "project-c", name: "Project C" });

      harness.metadataRequests.get("project-b")?.resolve(metadataWithResourceExtension);
      harness.appearanceRequests.get("project-b")?.resolve(emptyAppearance);
      await flushMicrotasks();
      await flushMicrotasks();

      expect(getCachedDashboardExtensionMetadata("project-b")).toBeUndefined();
      expect(harness.contributionApplications).toEqual([]);
      expect(harness.sidenavRefreshes).toEqual([]);

      await harness.settleProject("project-c", "appearance-first");

      expect(getCachedDashboardExtensionMetadata("project-c")).toBeDefined();
      expect(harness.contributionApplications).toHaveLength(1);
      expect(harness.contributionApplications.every((id) => id.includes("project-c"))).toBe(true);
      expect(harness.sidenavRefreshes).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });
});
