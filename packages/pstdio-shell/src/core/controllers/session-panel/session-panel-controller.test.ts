import { describe, expect, test } from "bun:test";
import { createShellSessionPanelController } from "./session-panel-controller";

describe("createShellSessionPanelController", () => {
  test("starts in bubble mode by default and exposes store state", () => {
    const controller = createShellSessionPanelController();

    expect(controller.getMode()).toBe("bubble");
    expect(controller.store.getState()).toEqual({ mode: "bubble" });
  });

  test("setMode updates state, ignores no-op transitions, and notifies listeners", () => {
    const controller = createShellSessionPanelController();
    const events: string[] = [];

    const disposable = controller.onDidChange((mode) => events.push(mode));

    controller.setMode("bubble");
    controller.setMode("attached");
    controller.setMode("attached");
    controller.setMode("closed");

    expect(controller.getMode()).toBe("closed");
    expect(events).toEqual(["attached", "closed"]);

    disposable.dispose();
    controller.setMode("attached");
    expect(events).toEqual(["attached", "closed"]);
  });

  test("respects initialMode", () => {
    const controller = createShellSessionPanelController({ initialMode: "attached" });

    expect(controller.getMode()).toBe("attached");
  });
});
