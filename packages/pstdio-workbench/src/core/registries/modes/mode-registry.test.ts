import { describe, expect, test } from "bun:test";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createLayoutModel, type LayoutModel } from "../layout/layout-model";
import {
  createWorkbenchModeRegistry,
  type WorkbenchModeActivationContext,
  type WorkbenchModeContribution,
} from "./mode-registry";

const createContext = (layout: LayoutModel) =>
  ({ context: createContextKeyService(), layout }) as unknown as WorkbenchModeActivationContext;

const trackingMode = (id: string, log: string[]): WorkbenchModeContribution => ({
  id,
  activate: () => {
    log.push(`activate:${id}`);
    return createDisposable(() => {
      log.push(`dispose:${id}`);
    });
  },
});

describe("createWorkbenchModeRegistry", () => {
  test("activates and disposes modes when active mode changes", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });

    registry.registerMode(trackingMode("project", log));
    registry.registerMode(trackingMode("settings", log));

    registry.setActiveMode("project");
    registry.setActiveMode("settings");
    registry.setActiveMode(undefined);

    expect(log).toEqual(["activate:project", "dispose:project", "activate:settings", "dispose:settings"]);
  });

  test("notifies listeners on active mode change", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    registry.registerMode({ id: "a", activate: () => undefined });

    registry.onDidChangeActive(() => log.push("change"));

    registry.setActiveMode("a");
    registry.setActiveMode("a"); // no-op
    registry.setActiveMode(undefined);

    expect(log).toEqual(["change", "change"]);
  });

  test("publishes active mode context keys", () => {
    const layout = createLayoutModel();
    const context = createContextKeyService();
    const registry = createWorkbenchModeRegistry({
      resolveContext: () => ({ context, layout }) as unknown as WorkbenchModeActivationContext,
    });

    registry.registerMode({ id: "project", activate: () => undefined });
    registry.setActiveMode("project");

    expect(context.matches("activeWorkbenchMode == project && workbenchMode.project")).toBe(true);

    registry.setActiveMode(undefined);

    expect(context.get("activeWorkbenchMode")).toBeUndefined();
    expect(context.get("workbenchMode.project")).toBeUndefined();
  });

  test("disposes the active mode when the registration is disposed", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    const registration = registry.registerMode(trackingMode("temp", log));

    registry.setActiveMode("temp");
    registration.dispose();

    expect(log).toEqual(["activate:temp", "dispose:temp"]);
    expect(registry.getActiveModeId()).toBeUndefined();
  });

  test("activates with multiple disposables in reverse order", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    const make = (id: string): Disposable => createDisposable(() => log.push(`dispose:${id}`));

    registry.registerMode({
      id: "multi",
      activate: () => [make("first"), make("second"), make("third")],
    });

    registry.setActiveMode("multi");
    registry.setActiveMode(undefined);

    expect(log).toEqual(["dispose:third", "dispose:second", "dispose:first"]);
  });

  test("preserves durable placements when switching modes", () => {
    const layout = createLayoutModel();
    layout.registerWidget({
      id: "workbench.status",
      title: "Status",
      region: "status",
      rendererId: "workbench.status",
    });
    layout.registerWidget({ id: "sessions.tree", title: "Sessions", region: "sidebar", rendererId: "sessions.tree" });
    layout.registerWidget({ id: "sessions.chat", title: "Session", region: "main", rendererId: "sessions.chat" });
    layout.openWidget("workbench.status", { pinned: true });

    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });

    registry.registerMode({
      id: "sessions",
      activate: (ctx) => {
        ctx.layout.openWidget("sessions.tree");
        ctx.layout.openWidget("sessions.chat");
        return undefined;
      },
    });
    registry.registerMode({
      id: "zen",
      activate: () => undefined,
    });

    registry.setActiveMode("sessions");

    expect(layout.getLayout().regions.sidebar.widgets).toHaveLength(1);
    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);

    registry.setActiveMode("zen");

    expect(layout.getLayout().regions.status.widgets).toHaveLength(1);
    expect(layout.getLayout().regions.sidebar.widgets).toEqual([]);
    expect(layout.getLayout().regions.main.widgets).toEqual([]);
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
  });

  test("re-runs activate from a clean layout when re-entering a mode", () => {
    const layout = createLayoutModel();
    layout.registerWidget({ id: "sessions.chat", title: "Session", region: "main", rendererId: "sessions.chat" });

    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    registry.registerMode({
      id: "sessions",
      activate: (ctx) => {
        ctx.layout.openWidget("sessions.chat");
        return undefined;
      },
    });
    registry.registerMode({ id: "zen", activate: () => undefined });

    registry.setActiveMode("sessions");
    // simulate user opening another instance, which would leak under the old behavior.
    layout.openWidget("sessions.chat");

    registry.setActiveMode("zen");
    expect(layout.getLayout().regions.main.widgets).toEqual([]);

    registry.setActiveMode("sessions");
    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
  });

  test("preserves Location-owned Sub Panels when switching modes", () => {
    const layout = createLayoutModel();
    layout.registerWidget({
      id: "sessions.chat",
      title: "Session",
      region: "side",
      rendererId: "sessions.chat",
      role: "sub-panel",
    });

    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    registry.registerMode({ id: "project", activate: () => undefined });
    registry.registerMode({ id: "sessions", activate: () => undefined });

    registry.setActiveMode("project");
    layout.openWidget("sessions.chat");
    registry.setActiveMode("sessions");

    expect(layout.getLayout().regions.side.widgets).toHaveLength(1);
  });
});
