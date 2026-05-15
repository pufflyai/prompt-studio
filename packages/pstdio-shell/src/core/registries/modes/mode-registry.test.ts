import { describe, expect, test } from "bun:test";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createShellModeRegistry, type ShellModeActivationContext } from "./mode-registry";

const emptyContext = {} as ShellModeActivationContext;

const trackingMode = (id: string, log: string[]) => ({
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
    const registry = createShellModeRegistry({ resolveContext: () => emptyContext });

    registry.registerMode(trackingMode("project", log));
    registry.registerMode(trackingMode("settings", log));

    registry.setActiveMode("project");
    registry.setActiveMode("settings");
    registry.setActiveMode(undefined);

    expect(log).toEqual(["activate:project", "dispose:project", "activate:settings", "dispose:settings"]);
  });

  test("notifies listeners on active mode change", () => {
    const log: string[] = [];
    const registry = createShellModeRegistry({ resolveContext: () => emptyContext });
    registry.registerMode({ id: "a", activate: () => undefined });

    registry.onDidChangeActive(() => log.push("change"));

    registry.setActiveMode("a");
    registry.setActiveMode("a"); // no-op
    registry.setActiveMode(undefined);

    expect(log).toEqual(["change", "change"]);
  });

  test("disposes the active mode when the registration is disposed", () => {
    const log: string[] = [];
    const registry = createShellModeRegistry({ resolveContext: () => emptyContext });
    const registration = registry.registerMode(trackingMode("temp", log));

    registry.setActiveMode("temp");
    registration.dispose();

    expect(log).toEqual(["activate:temp", "dispose:temp"]);
    expect(registry.getActiveModeId()).toBeUndefined();
  });

  test("activates with multiple disposables in reverse order", () => {
    const log: string[] = [];
    const registry = createShellModeRegistry({ resolveContext: () => emptyContext });
    const make = (id: string): Disposable => createDisposable(() => log.push(`dispose:${id}`));

    registry.registerMode({
      id: "multi",
      activate: () => [make("first"), make("second"), make("third")],
    });

    registry.setActiveMode("multi");
    registry.setActiveMode(undefined);

    expect(log).toEqual(["dispose:third", "dispose:second", "dispose:first"]);
  });
});
