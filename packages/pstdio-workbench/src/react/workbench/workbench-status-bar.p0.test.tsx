import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { useWorkbenchLayoutFlags } from "./use-workbench-layout-flags";
import { WorkbenchStatusBar } from "./workbench-panels";

describe("WorkbenchStatusBar", () => {
  test("an empty status bar reserves no layout space and follows visible items", async () => {
    const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    const workbench = createWorkbench();
    let flags: ReturnType<typeof useWorkbenchLayoutFlags> | undefined;
    const Probe = () => {
      flags = useWorkbenchLayoutFlags(workbench);
      return null;
    };
    let tree: ReturnType<typeof create> | undefined;
    try {
      await act(async () => {
        tree = create(<Probe />);
      });
      expect(flags?.hasDockedStatusBar).toBe(false);
      expect(flags?.hasStatusContent).toBe(false);
      workbench.views.registerView({
        id: "connection",
        title: "Connection",
        body: { kind: "react", render: () => <span>Connected</span> },
      });
      await act(async () => {
        workbench.statusBar.registerItem({
          id: "hidden",
          viewId: "connection",
          slot: "leading",
          isVisible: () => false,
        });
      });
      expect(flags?.hasDockedStatusBar).toBe(false);
      let item: ReturnType<typeof workbench.statusBar.registerItem> | undefined;
      await act(async () => {
        item = workbench.statusBar.registerItem({ id: "visible", viewId: "connection", slot: "leading" });
      });
      expect(flags?.hasDockedStatusBar).toBe(true);
      await act(async () => {
        item?.dispose();
      });
      expect(flags?.hasDockedStatusBar).toBe(false);
      await act(async () => {
        workbench.notifications.show({ id: "notice", level: "error", title: "Connection failed" });
      });
      expect(flags?.hasStatusContent).toBe(true);
      expect(flags?.hasDockedStatusBar).toBe(true);
      await act(async () => {
        workbench.notifications.dismiss("notice");
      });
      expect(flags?.hasStatusContent).toBe(false);
      await act(async () => {
        for (const id of ["shown", "quiet"]) workbench.modes.registerMode({ id, activate() {} });
        workbench.modes.registerMode({ id: "custom", chrome: { status: "connection" }, activate() {} });
        workbench.statusBar.registerItem({
          id: "mode-dependent",
          viewId: "connection",
          slot: "leading",
          isVisible: () => workbench.modes.getActiveModeId() === "shown",
        });
        workbench.modes.setActiveMode("shown");
      });
      expect(flags?.hasDockedStatusBar).toBe(true);
      await act(async () => {
        workbench.modes.setActiveMode("quiet");
      });
      expect(flags?.hasDockedStatusBar).toBe(false);
      await act(async () => {
        workbench.modes.setActiveMode("custom");
      });
      expect(flags?.hasDockedStatusBar).toBe(true);
    } finally {
      await act(async () => {
        tree?.unmount();
      });
      workbench.dispose();
      environment.IS_REACT_ACT_ENVIRONMENT = previous;
    }
  });

  test("renders a View-backed status item without a layout panel registration", () => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: "sync.connection",
      title: "Connection",
      body: { kind: "react", render: () => <span>Connected</span> },
    });
    workbench.statusBar.registerItem({
      id: "sync.connection.item",
      viewId: "sync.connection",
      slot: "leading",
    });
    expect(getWorkbenchRenderers(workbench).getRenderer("sync.connection")).toBeDefined();

    const markup = renderToStaticMarkup(
      <WorkbenchThemeProvider>
        <WorkbenchStatusBar workbench={workbench} />
      </WorkbenchThemeProvider>,
    );

    expect(markup).toContain("Connected");
  });
});
