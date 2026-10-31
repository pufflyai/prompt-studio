import { describe, expect, mock, test } from "bun:test";
import type {
  WorkbenchExtensionMetadata as DashboardExtensionMetadata,
  ListExtensionAppearanceResponse,
} from "@pstdio/sdk/api";
import { createWorkbench } from "@pstdio/workbench";
import i18n from "@/i18n";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  clearCachedDashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadataWithResourceExtension } from "./module-test-fixtures";

const translatedAppearance = (label?: string) => ({
  ...emptyAppearance,
  themes: [
    {
      id: "pstdio.extension-lab.theme.ink",
      extensionId: "pstdio.extension-lab",
      title: { $l10n: "label", default: "Theme fallback" },
      mode: "dark" as const,
      format: "vscode-color-theme" as const,
      source: { kind: "package-asset" as const, path: "./theme.json", baseUrl: "file:///palette/extension.ts" },
      tokens: { "colors.bg": "#282A36" },
      monacoTheme: { base: "vs-dark" as const, inherit: true as const, rules: [], colors: {} },
    },
  ],
  translations: label ? [{ extensionId: "pstdio.extension-lab", defaultLocale: "en", bundles: { en: { label } } }] : [],
});

interface Deferred<TValue> {
  promise: Promise<TValue>;
  resolve: (value: TValue) => void;
  reject: (error: Error) => void;
}

const deferred = <TValue>(): Deferred<TValue> => {
  let resolve: ((value: TValue) => void) | undefined;
  let reject: ((error: Error) => void) | undefined;
  const promise = new Promise<TValue>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return {
    promise,
    resolve: (value) => resolve?.(value),
    reject: (error) => reject?.(error),
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
  const workbench = createWorkbench();

  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.views.registerView({
    id: dashboardWidgetIds.dashboardSidenav,
    title: "Sidenav",
    body: { kind: "tree", getBody: () => [], getChildren: () => [] },
  });

  const contributionApplications: string[] = [];
  const unsubscribeResources = workbench.resources.store.subscribe((state, previous) => {
    for (const providerId of Object.keys(state.hierarchyProviders)) {
      if (providerId in previous.hierarchyProviders) continue;
      if (!providerId.startsWith("dashboard.extensions.resource-hierarchy.")) continue;
      contributionApplications.push(providerId);
    }
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
    settingsRefreshes.length = 0;
    loadAppearance.mockClear();
    loadMetadata.mockClear();
  };

  const dispose = () => {
    moduleDisposable.dispose();
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
    workbench,
  };
};

describe("project-switch extension refresh", () => {
  test("localizes a destination theme without the previous catalog's bundles", async () => {
    const harness = createBaselineHarness();
    try {
      harness.appearanceRequests.get("project-a")?.resolve(translatedAppearance("Previous"));
      await flushMicrotasks();
      selectDashboardProject(harness.workbench, { id: "project-b", name: "Project B" });
      harness.appearanceRequests.get("project-b")?.resolve(translatedAppearance());
      await flushMicrotasks();
      expect(harness.workbench.themes.listThemes()[0]?.title).toBe("Theme fallback");
    } finally {
      harness.dispose();
    }
  });

  test("clears project translations while retaining appearance through a failed load", async () => {
    const harness = createBaselineHarness();
    try {
      harness.appearanceRequests.get("project-a")?.resolve(translatedAppearance("Previous"));
      await flushMicrotasks();
      selectDashboardProject(harness.workbench, { id: "project-b", name: "Project B" });
      harness.metadataRequests.get("project-b")?.resolve({
        ...metadataWithResourceExtension,
        commands: metadataWithResourceExtension.commands.map((command) => ({
          ...command,
          title: { $l10n: "label", default: "Destination command" },
        })),
      });
      await flushMicrotasks();
      expect(getCachedDashboardExtensionMetadata("project-b")?.commands[0]?.title).toBe("Destination command");
      harness.appearanceRequests.get("project-b")?.reject(new Error("Appearance unavailable"));
      await flushMicrotasks();
      await i18n.changeLanguage("en");
      expect(getCachedDashboardExtensionMetadata("project-b")?.commands[0]?.title).toBe("Destination command");
      expect(harness.workbench.themes.listThemes()[0]?.id).toBe("pstdio.extension-lab.theme.ink");
    } finally {
      harness.dispose();
    }
  });

  test("keeps resolved appearance until the destination catalog arrives", async () => {
    const harness = createBaselineHarness();
    const theme = {
      id: "acme.palette.theme.ink",
      extensionId: "acme.palette",
      title: "Ink",
      mode: "dark" as const,
      format: "vscode-color-theme" as const,
      source: { kind: "package-asset" as const, path: "./theme.json", baseUrl: "file:///palette/extension.ts" },
      tokens: { "colors.bg": "#282A36" },
      monacoTheme: { base: "vs-dark" as const, inherit: true as const, rules: [], colors: {} },
    };
    try {
      harness.appearanceRequests.get("project-a")?.resolve({ ...emptyAppearance, themes: [theme] });
      await flushMicrotasks();
      expect(harness.workbench.themes.listThemes().map((item) => item.id)).toEqual([theme.id]);
      const catalogs: string[][] = [];
      const unsubscribe = harness.workbench.themes.store.subscribe((state) => {
        catalogs.push(state.themes.map((item) => item.id));
      });
      selectDashboardProject(harness.workbench, { id: "project-b", name: "Project B" });
      expect(harness.workbench.themes.listThemes().map((item) => item.id)).toEqual([theme.id]);
      selectDashboardProject(harness.workbench, { id: "project-c", name: "Project C" });
      harness.appearanceRequests.get("project-b")?.resolve(emptyAppearance);
      await flushMicrotasks();
      expect(harness.workbench.themes.listThemes().map((item) => item.id)).toEqual([theme.id]);
      harness.appearanceRequests.get("project-c")?.resolve({ ...emptyAppearance, themes: [theme] });
      await flushMicrotasks();
      expect(catalogs.every((ids) => ids.includes(theme.id))).toBe(true);
      expect(catalogs.every((ids) => new Set(ids).size === ids.length)).toBe(true);
      selectDashboardProject(harness.workbench, { id: "project-b", name: "Project B" });
      harness.appearanceRequests.get("project-b")?.reject(new Error("Appearance unavailable"));
      await flushMicrotasks();
      expect(harness.workbench.themes.listThemes().map((item) => item.id)).toEqual([theme.id]);
      // A settled empty catalog represents removal, rather than temporary loading.
      selectDashboardProject(harness.workbench, { id: "project-c", name: "Project C" });
      selectDashboardProject(harness.workbench, { id: "project-b", name: "Project B" });
      harness.appearanceRequests.get("project-b")?.resolve(emptyAppearance);
      await flushMicrotasks();
      expect(harness.workbench.themes.listThemes()).toEqual([]);
      unsubscribe();
    } finally {
      harness.dispose();
    }
  });

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

      await harness.settleProject("project-c", "appearance-first");

      expect(getCachedDashboardExtensionMetadata("project-c")).toBeDefined();
      expect(harness.contributionApplications).toHaveLength(1);
      expect(harness.contributionApplications.every((id) => id.includes("project-c"))).toBe(true);
    } finally {
      harness.dispose();
    }
  });
});
