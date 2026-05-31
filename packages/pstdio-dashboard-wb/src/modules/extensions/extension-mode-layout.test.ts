import { describe, expect, mock, test } from "bun:test";
import type { WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { createExtensionContributionsModule } from "./module";

const webview = (path: string, webviewId: string) => ({
  entry: { kind: "package-asset" as const, path, baseUrl: "file:///extension/extension.ts" },
  runtimeUrl: "/v1/extensions/runtime",
  moduleUrl: `/v1/extensions/installed/extension-lab/webviews/${webviewId}/module.js`,
});

const metadata = {
  extensions: [{ id: "pstdio.extension-lab", name: "extension-lab", displayName: "Extension Lab", sourcePath: "" }],
  commands: [],
  diagnostics: [],
  menuContributions: [],
  navigation: [],
  routes: [],
  treeItems: [
    {
      id: "extension-lab.openLabMode",
      extensionId: "pstdio.extension-lab",
      target: "workbench.left.tree",
      label: "Lab",
      action: {
        kind: "command",
        commandId: "workbench.action.switchMode",
        args: { modeId: "pstdio.extension-lab.lab" },
      },
    },
  ],
  modes: [
    {
      id: "extension-lab.lab",
      extensionId: "pstdio.extension-lab",
      modeId: "pstdio.extension-lab.lab",
      label: "Lab",
      layout: {
        reset: true,
        open: [
          { target: "workbench.left", view: "extension-lab.labSidebar", pinned: true },
          { target: "workbench.main", view: "extension-lab.labOverview" },
        ],
      },
    },
    {
      id: "extension-lab.focus",
      extensionId: "pstdio.extension-lab",
      modeId: "pstdio.extension-lab.focus",
      label: "Lab focus",
      layout: {
        reset: ["workbench.main"],
        open: [{ target: "workbench.main", view: "extension-lab.labOverview" }],
      },
    },
  ],
  settingsPanels: [],
  views: [
    {
      id: "extension-lab.labSidebar",
      extensionId: "pstdio.extension-lab",
      slotId: "unknown",
      title: "Lab sidebar",
      webview: webview("./src/lab-sidebar.tsx", "extension-lab.labSidebar"),
    },
    {
      id: "extension-lab.labOverview",
      extensionId: "pstdio.extension-lab",
      slotId: "unknown",
      title: "Lab overview",
      webview: webview("./src/lab-overview.tsx", "extension-lab.labOverview"),
    },
  ],
} satisfies DashboardExtensionMetadata;

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const registerWidget = (
  workbench: ReturnType<typeof createWorkbenchCore>,
  id: string,
  area: "top" | "left" | "main" | "floating",
) => {
  workbench.layout.registerWidget({ id, title: id, area, rendererId: id });
  workbench.layout.openWidget(id);
};

const setupWorkbench = async () => {
  const loadMetadata = mock(async () => metadata);
  const workbench = createWorkbenchCore();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
  workbench.registerModule(createExtensionContributionsModule({ loadMetadata }));
  await flushMicrotasks();
  return workbench;
};

describe("dashboard extension mode layout activation", () => {
  test("resets only safe targets and opens declared extension views", async () => {
    const workbench = await setupWorkbench();
    registerWidget(workbench, "host.top", "top");
    registerWidget(workbench, "host.left", "left");
    registerWidget(workbench, "host.main", "main");
    registerWidget(workbench, "host.floating", "floating");

    await workbench.commands.executeCommand("workbench.action.switchMode", { modeId: "pstdio.extension-lab.lab" });

    const layout = workbench.layout.getLayout();
    expect(layout.areas.top.widgets.map((placement) => placement.contributionId)).toEqual(["host.top"]);
    expect(layout.areas.floating.widgets.map((placement) => placement.contributionId)).toEqual(["host.floating"]);
    expect(layout.areas.left.widgets).toEqual([
      expect.objectContaining({
        contributionId: "dashboard-workbench.extension-view.extension-lab.labSidebar",
        pinned: true,
      }),
    ]);
    expect(layout.areas.main.widgets).toEqual([
      expect.objectContaining({
        contributionId: "dashboard-workbench.extension-view.extension-lab.labOverview",
      }),
    ]);
  });

  test("disposes mode-opened placements when switching modes", async () => {
    const workbench = await setupWorkbench();

    await workbench.commands.executeCommand("workbench.action.switchMode", { modeId: "pstdio.extension-lab.lab" });
    await workbench.commands.executeCommand("workbench.action.switchMode", { modeId: "project" });

    expect(workbench.layout.getLayout().areas.left.widgets).toEqual([]);
    expect(workbench.layout.getLayout().areas.main.widgets).toEqual([]);
  });

  test("partial reset leaves other safe targets intact", async () => {
    const workbench = await setupWorkbench();
    registerWidget(workbench, "host.left", "left");
    registerWidget(workbench, "host.main", "main");

    await workbench.commands.executeCommand("workbench.action.switchMode", { modeId: "pstdio.extension-lab.focus" });

    const layout = workbench.layout.getLayout();
    expect(layout.areas.left.widgets.map((placement) => placement.contributionId)).toEqual(["host.left"]);
    expect(layout.areas.main.widgets.map((placement) => placement.contributionId)).toEqual([
      "dashboard-workbench.extension-view.extension-lab.labOverview",
    ]);
  });
});
