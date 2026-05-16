import { describe, expect, test } from "bun:test";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createLayoutModel, type LayoutModel } from "../layout/layout-model";
import { createShellModeRegistry, type ShellModeActivationContext, type ShellModeContribution } from "./mode-registry";

const createContext = (layout: LayoutModel) => ({ layout }) as unknown as ShellModeActivationContext;

const trackingMode = (id: string, log: string[]): ShellModeContribution => ({
  id,
  activate: () => {
    log.push(`activate:${id}`);
    return createDisposable(() => {
      log.push(`dispose:${id}`);
    });
  },
});

describe("createShellModeRegistry", () => {
  test("activates and disposes modes when active mode changes", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createShellModeRegistry({ resolveContext: () => createContext(layout) });

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
    const registry = createShellModeRegistry({ resolveContext: () => createContext(layout) });
    registry.registerMode({ id: "a", activate: () => undefined });

    registry.onDidChangeActive(() => log.push("change"));

    registry.setActiveMode("a");
    registry.setActiveMode("a"); // no-op
    registry.setActiveMode(undefined);

    expect(log).toEqual(["change", "change"]);
  });

  test("disposes the active mode when the registration is disposed", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createShellModeRegistry({ resolveContext: () => createContext(layout) });
    const registration = registry.registerMode(trackingMode("temp", log));

    registry.setActiveMode("temp");
    registration.dispose();

    expect(log).toEqual(["activate:temp", "dispose:temp"]);
    expect(registry.getActiveModeId()).toBeUndefined();
  });

  test("activates with multiple disposables in reverse order", () => {
    const log: string[] = [];
    const layout = createLayoutModel();
    const registry = createShellModeRegistry({ resolveContext: () => createContext(layout) });
    const make = (id: string): Disposable => createDisposable(() => log.push(`dispose:${id}`));

    registry.registerMode({
      id: "multi",
      activate: () => [make("first"), make("second"), make("third")],
    });

    registry.setActiveMode("multi");
    registry.setActiveMode(undefined);

    expect(log).toEqual(["dispose:third", "dispose:second", "dispose:first"]);
  });

  test("resets layout placements when switching modes", () => {
    const layout = createLayoutModel();
    layout.registerWidget({ id: "sessions.tree", title: "Sessions", area: "left", rendererId: "sessions.tree" });
    layout.registerWidget({ id: "sessions.chat", title: "Session", area: "main", rendererId: "sessions.chat" });

    const registry = createShellModeRegistry({ resolveContext: () => createContext(layout) });

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

    expect(layout.getLayout().areas.left.widgets).toHaveLength(1);
    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);

    registry.setActiveMode("zen");

    expect(layout.getLayout().areas.left.widgets).toEqual([]);
    expect(layout.getLayout().areas.main.widgets).toEqual([]);
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
  });

  test("re-runs activate from a clean layout when re-entering a mode", () => {
    const layout = createLayoutModel();
    layout.registerWidget({ id: "sessions.chat", title: "Session", area: "main", rendererId: "sessions.chat" });

    const registry = createShellModeRegistry({ resolveContext: () => createContext(layout) });
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
    expect(layout.getLayout().areas.main.widgets).toEqual([]);

    registry.setActiveMode("sessions");
    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);
  });
});
