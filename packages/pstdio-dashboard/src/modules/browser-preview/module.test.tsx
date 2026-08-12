import { afterEach, describe, expect, test } from "bun:test";
import { createWorkbenchCore, type WorkbenchLayout } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createBrowserPreviewModule } from "./module";

const createWorkbench = () => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createBrowserPreviewModule());
  return workbench;
};

const runtimeConfigKey = "__PSTDIO_CONFIG__";

type RuntimeConfigGlobal = typeof globalThis & {
  [runtimeConfigKey]?: {
    apiBaseUrl?: string;
  };
};

describe("createBrowserPreviewModule", () => {
  afterEach(() => {
    delete (globalThis as RuntimeConfigGlobal)[runtimeConfigKey];
  });

  test("requires a selected project", async () => {
    const workbench = createWorkbench();

    await expect(workbench.commands.executeCommand(dashboardCommandIds.openBrowserPreview)).rejects.toThrow(
      "Browser Preview requires a selected project.",
    );
  });

  test("opens a new persistent main panel on every command invocation", async () => {
    const workbench = createWorkbench();
    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-a");

    const first = await workbench.commands.executeCommand(dashboardCommandIds.openBrowserPreview, {
      url: "https://example.test/app",
    });
    const second = await workbench.commands.executeCommand(dashboardCommandIds.openBrowserPreview, {
      url: "https://example.test/app",
    });

    const panels = workbench.layout.listPanelInstances("main");
    expect((first as { instanceId: string }).instanceId).not.toBe((second as { instanceId: string }).instanceId);
    expect(panels).toHaveLength(2);
    expect(panels.map((panel) => panel.panelId)).toEqual([
      dashboardWidgetIds.browserPreview,
      dashboardWidgetIds.browserPreview,
    ]);
    expect(panels.map((panel) => panel.resource?.metadata?.url)).toEqual([
      "https://example.test/app",
      "https://example.test/app",
    ]);
    expect(workbench.layout.getPanel(dashboardWidgetIds.browserPreview)).toMatchObject({
      closable: true,
      mountStrategy: "keep-mounted",
      region: "main",
      reuse: "none",
      singleton: false,
    });
    expect(workbench.layout.getWidget(dashboardWidgetIds.browserPreview)?.role).toBe("sub-panel");
  });

  test("offers Browser Preview from the Add panel surface for a normal dashboard location", () => {
    const workbench = createWorkbench();
    const browserPreview = workbench.layout.getWidget(dashboardWidgetIds.browserPreview);

    expect(browserPreview?.openCommandId).toBe(dashboardCommandIds.openBrowserPreview);
    expect(browserPreview?.resourceKinds).toBeUndefined();
  });

  test("restores open previews with their own state and leaves closed previews out", async () => {
    let savedLayout: WorkbenchLayout | undefined;
    const createPersistentWorkbench = () => {
      const workbench = createWorkbenchCore({
        layoutPersistence: {
          getLayout: () => savedLayout,
          setLayout: (layout) => {
            savedLayout = structuredClone(layout);
          },
        },
      });
      workbench.registerModule(createBrowserPreviewModule());
      workbench.context.set(dashboardSelectedProjectIdContextKey, "project-a");
      return workbench;
    };
    const firstWorkbench = createPersistentWorkbench();

    const kept = await firstWorkbench.commands.executeCommand(dashboardCommandIds.openBrowserPreview, {
      url: "https://example.test/kept",
      viewport: { mode: "mobile" },
    });
    const closed = await firstWorkbench.commands.executeCommand(dashboardCommandIds.openBrowserPreview, {
      url: "https://example.test/closed",
      viewport: { mode: "desktop" },
    });
    firstWorkbench.layout.closePanel((closed as { instanceId: string }).instanceId);

    const restoredWorkbench = createPersistentWorkbench();
    const restored = restoredWorkbench.layout.listPanelInstances("main");

    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      instanceId: (kept as { instanceId: string }).instanceId,
      resource: {
        metadata: {
          projectId: "project-a",
          url: "https://example.test/kept",
          viewport: { mode: "mobile" },
        },
      },
    });
  });

  test("rejects invalid supplied URLs before opening a placement", async () => {
    const workbench = createWorkbench();
    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-a");

    await expect(
      workbench.commands.executeCommand(dashboardCommandIds.openBrowserPreview, { url: "ftp://example.test" }),
    ).rejects.toThrow("Browser Preview supports only HTTP(S) URLs.");
    expect(workbench.layout.listPanelInstances("main")).toHaveLength(0);
  });

  test("rejects the configured API origin before opening a placement", async () => {
    const workbench = createWorkbench();
    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-a");
    (globalThis as RuntimeConfigGlobal)[runtimeConfigKey] = { apiBaseUrl: "http://localhost:19840" };

    await expect(
      workbench.commands.executeCommand(dashboardCommandIds.openBrowserPreview, { url: "http://127.0.0.1:19840/v1" }),
    ).rejects.toThrow("Browser Preview cannot open the Prompt Studio host origin.");
    expect(workbench.layout.listPanelInstances("main")).toHaveLength(0);
  });
});
