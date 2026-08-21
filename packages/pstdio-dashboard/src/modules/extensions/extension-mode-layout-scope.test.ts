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
        panelRegions: ["main", "secondary", "side"] as ("main" | "secondary" | "side")[],
        modePanels: { "extension-lab.reviewChecklist": { region: "secondary" as const, required: true } },
      },
    ],
    panels: [
      ...metadataWithLabMode.panels,
      {
        id: "extension-lab.reviewChecklist",
        extensionId: "pstdio.extension-lab",
        show: { region: "secondary" as const },
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
