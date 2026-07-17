import { describe, expect, test } from "bun:test";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { classicFrame } from "../layout/classic-frame";
import { defineFrame } from "../layout/frame";
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
  test("installs a mode frame before activation and restores the default frame", () => {
    const focusFrame = defineFrame({
      id: "focus",
      root: {
        kind: "split",
        id: "focus-root",
        direction: "row",
        children: [classicFrame.slots.main, classicFrame.slots.side],
      },
      primary: "main",
      attached: { slot: "side", persistence: "detached", candidates: "scoped" },
    });
    const layout = createLayoutModel();
    layout.registerWidget({ id: "focus.inspector", title: "Inspector", area: "side", rendererId: "inspector" });
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });

    registry.registerMode({
      id: "focus",
      frame: focusFrame,
      activate: (ctx) => {
        expect(ctx.layout.getFrame()).toBe(focusFrame);
        ctx.layout.openWidget("focus.inspector");
      },
    });

    registry.setActiveMode("focus");

    expect(layout.getFrame()).toBe(focusFrame);
    expect(layout.getLayout().areas.side?.widgets).toHaveLength(1);

    registry.setActiveMode(undefined);

    expect(layout.getFrame()).toBe(classicFrame);
  });

  test("uses the default frame for a mode without a frame", () => {
    const customDefault = defineFrame({
      id: "custom-default",
      root: classicFrame.slots.main,
      primary: "main",
    });
    const alternate = defineFrame({
      id: "alternate",
      root: {
        kind: "split",
        id: "alternate-root",
        direction: "row",
        children: [classicFrame.slots.main, classicFrame.slots.side],
      },
      primary: "main",
      attached: { slot: "side", persistence: "detached", candidates: "scoped" },
    });
    const layout = createLayoutModel({ frame: customDefault });
    const registry = createWorkbenchModeRegistry({ resolveContext: () => createContext(layout) });
    registry.registerMode({ id: "alternate", frame: alternate, activate: () => undefined });
    registry.registerMode({ id: "default", activate: () => undefined });

    registry.setActiveMode("alternate");
    registry.setActiveMode("default");

    expect(layout.getFrame()).toBe(customDefault);
  });

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
    const tempFrame = defineFrame({ id: "temp", root: classicFrame.slots.main, primary: "main" });
    const registration = registry.registerMode({ ...trackingMode("temp", log), frame: tempFrame });

    registry.setActiveMode("temp");
    registration.dispose();

    expect(log).toEqual(["activate:temp", "dispose:temp"]);
    expect(registry.getActiveModeId()).toBeUndefined();
    expect(layout.getFrame()).toBe(classicFrame);
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
