import { describe, expect, test } from "bun:test";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createLayoutModel, type LayoutModel, type WorkbenchLayout } from "../layout/layout-model";
import { layoutScopeKey } from "../layout/layout-scope";
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

  test("restores mode placements instead of tearing them down", () => {
    const saved = new Map<string, WorkbenchLayout>();
    const layout = createLayoutModel({
      persistence: {
        getLayout: (scope) => saved.get(layoutScopeKey(scope)),
        setLayout: (state, scope) => saved.set(layoutScopeKey(scope), structuredClone(state)),
      },
    });
    layout.registerWidget({ id: "sessions.tree", title: "Sessions", area: "left", rendererId: "sessions.tree" });
    layout.registerWidget({ id: "sessions.chat", title: "Session", area: "main", rendererId: "sessions.chat" });

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
    expect(layout.getLayout().areas.left?.widgets).toHaveLength(1);
    expect(layout.getLayout().areas.main?.widgets).toHaveLength(1);

    registry.setActiveMode("zen");
    expect(layout.getLayout().areas.left?.widgets).toEqual([]);
    expect(layout.getLayout().areas.main?.widgets).toEqual([]);

    registry.setActiveMode("sessions");
    expect(layout.getLayout().areas.left?.widgets).toHaveLength(1);
    expect(layout.getLayout().areas.main?.widgets).toHaveLength(1);
  });
});
