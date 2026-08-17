import { expect, mock, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createProjectsModule } from "../projects/module";
import { createSidenavModule } from "../sidenav/module";
import { createExtensionsModule } from "./module";
import { flushMicrotasks, metadataWithLabMode } from "./module-test-fixtures";

test("opens a newly selected mode's declared Panel regions after dashboard scope synchronization", async () => {
  const reviewMetadata = {
    ...metadataWithLabMode,
    modes: [
      ...metadataWithLabMode.modes,
      {
        id: "extension-lab.review",
        extensionId: "pstdio.extension-lab",
        modeId: "pstdio.extension-lab.review",
        label: "Review lab",
        icon: "scan-search",
        layout: {
          panels: ["main", "secondary", "side"] as ("main" | "secondary" | "side")[],
          open: [{ region: "secondary" as const, panel: "extension-lab.reviewChecklist" }],
        },
      },
    ],
    panels: [
      ...metadataWithLabMode.panels,
      {
        id: "extension-lab.reviewChecklist",
        extensionId: "pstdio.extension-lab",
        region: "secondary" as const,
        closable: true,
        title: "Review checklist",
        webview: {
          entry: {
            kind: "package-asset" as const,
            path: "./src/review-checklist.tsx",
            baseUrl: "file:///extension/extension.ts",
          },
          runtimeUrl: "/v1/extensions/runtime",
          moduleUrl: "/v1/extensions/installed/extension-lab/webviews/extension-lab.reviewChecklist/module.js",
        },
      },
    ],
  };
  const loadMetadata = mock(async () => reviewMetadata);
  const workbench = createWorkbenchCore();

  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const extensionsDisposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));
  const projectsDisposable = workbench.registerModule(createProjectsModule());

  try {
    await flushMicrotasks();
    workbench.modes.setActiveMode("pstdio.extension-lab.lab");
    workbench.panels.setOpen("secondary", false);
    workbench.layout.setRegionVisible("secondary", false);

    workbench.modes.setActiveMode("pstdio.extension-lab.review");

    expect(workbench.panels.isOpen("secondary")).toBe(true);
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(true);
    expect(workbench.layout.getLayout().regions.secondary.widgets.map((widget) => widget.contributionId)).toEqual([
      "dashboard-workbench.extension-view.extension-lab.reviewChecklist",
    ]);
  } finally {
    projectsDisposable.dispose();
    extensionsDisposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});

test("keeps a native Main Sub Panel attached to the extension mode Location", async () => {
  const artifactMetadata = {
    ...metadataWithLabMode,
    modes: metadataWithLabMode.modes.map((mode) => ({
      ...mode,
      layout: {
        ...mode.layout,
        open: [...mode.layout.open, { region: "main" as const, panel: "extension-lab.artifacts" }],
      },
    })),
    panels: [
      ...metadataWithLabMode.panels,
      {
        id: "extension-lab.artifacts",
        extensionId: "pstdio.extension-lab",
        title: "Artifacts",
        region: "main" as const,
        closable: false,
        renderer: { kind: "dataTable" as const, id: "extension-lab.artifacts" },
        eligibleLocations: { resourceKinds: ["extension-view"] },
      },
    ],
    dataTableRenderers: [
      {
        id: "extension-lab.artifacts",
        extensionId: "pstdio.extension-lab",
        title: "Artifacts",
        queryHandlerId: "extension-lab.artifacts.query",
      },
    ],
  };
  const loadMetadata = mock(async () => artifactMetadata);
  const workbench = createWorkbenchCore();

  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const extensionsDisposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));
  const projectsDisposable = workbench.registerModule(createProjectsModule());

  try {
    await flushMicrotasks();
    workbench.modes.setActiveMode("pstdio.extension-lab.lab");

    expect(workbench.layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({
        contributionId: "dashboard-workbench.extension-view.extension-lab.labOverview",
        role: "location",
      }),
      expect.objectContaining({
        contributionId: "extension-lab.artifacts",
        role: "sub-panel",
      }),
    ]);
    expect(workbench.layout.getLayout().activeLocationWidgetId).toBe(
      "dashboard-workbench.extension-view.extension-lab.labOverview",
    );
  } finally {
    projectsDisposable.dispose();
    extensionsDisposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});

test("keeps an extension mode's explicit Sidenav active after dashboard mode synchronization", async () => {
  const loadMetadata = mock(async () => metadataWithLabMode);
  const workbench = createWorkbenchCore();

  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const extensionsDisposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));
  const projectsDisposable = workbench.registerModule(createProjectsModule());
  const sidenavDisposable = workbench.registerModule(createSidenavModule());

  try {
    await flushMicrotasks();
    workbench.modes.setActiveMode("pstdio.extension-lab.lab");

    expect(workbench.layout.getLayout().regions.sidenav.activeWidgetId).toBe(
      "dashboard-workbench.extension-view.extension-lab.labSidenav",
    );
  } finally {
    sidenavDisposable.dispose();
    projectsDisposable.dispose();
    extensionsDisposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});
