import { describe, expect, test } from "bun:test";
import { createWorkbenchCommandPaletteController } from "./command-palette-controller";

describe("createWorkbenchCommandPaletteController", () => {
  test("opens and closes through domain methods and exposes store state", () => {
    const controller = createWorkbenchCommandPaletteController();

    expect(controller.isOpen()).toBe(false);
    expect(controller.store.getState()).toEqual({ open: false, view: "main", initialQuery: "", paramsRequest: null });

    controller.open();

    expect(controller.isOpen()).toBe(true);
    expect(controller.store.getState()).toEqual({ open: true, view: "main", initialQuery: "", paramsRequest: null });

    controller.close();

    expect(controller.isOpen()).toBe(false);
  });

  test("opens a specific view and resets it when closed", () => {
    const controller = createWorkbenchCommandPaletteController();

    controller.open({ view: "mode", initialQuery: "> " });

    expect(controller.isOpen()).toBe(true);
    expect(controller.getView()).toBe("mode");
    expect(controller.getInitialQuery()).toBe("> ");

    controller.close();

    expect(controller.store.getState()).toEqual({ open: false, view: "main", initialQuery: "", paramsRequest: null });
  });

  test("toggle flips between open and closed", () => {
    const controller = createWorkbenchCommandPaletteController();

    controller.toggle();
    expect(controller.isOpen()).toBe(true);

    controller.toggle();
    expect(controller.isOpen()).toBe(false);
  });

  test("emits change events through onDidChange and store subscribers", () => {
    const controller = createWorkbenchCommandPaletteController();
    const events: boolean[] = [];
    const storeEvents: boolean[] = [];

    const legacy = controller.onDidChange((value) => events.push(value));
    const fromStore = controller.store.subscribeSelector(
      (state) => state.open,
      (value) => storeEvents.push(value),
    );

    controller.open();
    controller.open();
    controller.close();
    controller.toggle();

    expect(events).toEqual([true, false, true]);
    expect(storeEvents).toEqual([true, false, true]);

    legacy.dispose();
    fromStore();
  });

  test("holds a params request independently of palette open state", () => {
    const controller = createWorkbenchCommandPaletteController();
    const request = {
      record: { command: { id: "demo", label: "Demo", params: { name: { type: "text" } } } },
      label: "Demo",
    };

    expect(controller.getParamsRequest()).toBeNull();

    controller.requestParams(request);
    expect(controller.getParamsRequest()).toEqual(request);
    expect(controller.store.getState().paramsRequest).toEqual(request);

    // Closing the palette must not drop a pending request (e.g. a palette entry
    // closes the palette, then the params dialog opens for the same command).
    controller.close();
    expect(controller.getParamsRequest()).toEqual(request);

    controller.clearParams();
    expect(controller.getParamsRequest()).toBeNull();
  });

  test("honors initialOpen", () => {
    const controller = createWorkbenchCommandPaletteController({ initialOpen: true });

    expect(controller.isOpen()).toBe(true);
  });
});
