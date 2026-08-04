import { describe, expect, test } from "bun:test";
import { createWorkbenchSidePanelController } from "./side-panel-controller";

describe("createWorkbenchSidePanelController", () => {
  test("starts floating by default and exposes generic Side Panel state", () => {
    const controller = createWorkbenchSidePanelController();

    expect(controller.getMode()).toBe("floating");
    expect(controller.store.getState()).toEqual({ mode: "floating" });
  });

  test("updates placement once per real transition and notifies listeners", () => {
    const controller = createWorkbenchSidePanelController();
    const events: string[] = [];
    const disposable = controller.onDidChange((mode) => events.push(mode));

    controller.setMode("floating");
    controller.setMode("attached");
    controller.setMode("attached");
    controller.setMode("closed");

    expect(controller.getMode()).toBe("closed");
    expect(events).toEqual(["attached", "closed"]);

    disposable.dispose();
    controller.setMode("floating");
    expect(events).toEqual(["attached", "closed"]);
  });

  test("respects an attached initial mode", () => {
    const controller = createWorkbenchSidePanelController({ initialMode: "attached" });

    expect(controller.getMode()).toBe("attached");
  });

  test("prefers a persisted mode over the initial mode", () => {
    const persistence = { getMode: () => "attached" as const, setMode: () => undefined };

    const controller = createWorkbenchSidePanelController({ initialMode: "closed", persistence });

    expect(controller.getMode()).toBe("attached");
  });

  test("falls back to the initial mode when nothing is persisted", () => {
    const persistence = { getMode: () => undefined, setMode: () => undefined };

    const controller = createWorkbenchSidePanelController({ initialMode: "closed", persistence });

    expect(controller.getMode()).toBe("closed");
  });

  test("writes only real mode transitions", () => {
    const written: string[] = [];
    const persistence = { getMode: () => undefined, setMode: (mode: string) => void written.push(mode) };
    const controller = createWorkbenchSidePanelController({ initialMode: "closed", persistence });

    controller.setMode("closed");
    controller.setMode("attached");
    controller.setMode("attached");
    controller.setMode("floating");

    expect(written).toEqual(["attached", "floating"]);
  });
});
