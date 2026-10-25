import { describe, expect, test } from "bun:test";
import { createWorkbenchCommandPaletteController } from "./command-palette-controller";

describe("createWorkbenchCommandPaletteController", () => {
  test("keeps a resource search scoped to its opener and clears it on close or normal open", () => {
    const controller = createWorkbenchCommandPaletteController();
    const resourceSearch = { label: "Switch session", placeholder: "Search sessions", list: () => [] };
    controller.open({ resourceSearch });
    expect(controller.store.getState().resourceSearch).toBe(resourceSearch);
    controller.close();
    expect(controller.store.getState().resourceSearch).toBeNull();
    controller.open({ resourceSearch });
    controller.open();
    expect(controller.store.getState().resourceSearch).toBeNull();
  });
  test("opens and closes through domain methods and exposes store state", () => {
    const controller = createWorkbenchCommandPaletteController();

    expect(controller.isOpen()).toBe(false);
    expect(controller.store.getState()).toMatchObject({
      open: false,
      view: "main",
      initialQuery: "",
      paramsRequest: null,
      confirmation: null,
      resourceSearch: null,
    });

    controller.open();

    expect(controller.isOpen()).toBe(true);
    expect(controller.store.getState()).toMatchObject({
      open: true,
      view: "main",
      initialQuery: "",
      paramsRequest: null,
      confirmation: null,
      resourceSearch: null,
    });

    controller.close();

    expect(controller.isOpen()).toBe(false);
  });

  test("opens a specific view and resets it when closed", () => {
    const controller = createWorkbenchCommandPaletteController();

    controller.open({ view: "theme", initialQuery: "> " });

    expect(controller.isOpen()).toBe(true);
    expect(controller.getView()).toBe("theme");
    expect(controller.getInitialQuery()).toBe("> ");

    controller.close();

    expect(controller.store.getState()).toMatchObject({
      open: false,
      view: "main",
      initialQuery: "",
      paramsRequest: null,
      confirmation: null,
      resourceSearch: null,
    });
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

    const listener = controller.onDidChange((value) => events.push(value));
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

    listener.dispose();
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

  test("a captured close survives command params and confirmation updates", async () => {
    const controller = createWorkbenchCommandPaletteController({ initialOpen: true });
    let closed = false;
    const close = controller.captureClose(() => {
      closed = true;
    });
    const confirmed = controller.requestConfirmation("Archive session");
    controller.store.getState().confirmation?.resolve(true);
    expect(await confirmed).toBe(true);
    controller.requestParams({ record: { command: { id: "demo", label: "Demo" } }, label: "Demo" });
    controller.clearParams();

    close();

    expect(closed).toBe(true);
  });

  test.each([
    "identical open",
    "another view",
    "close and reopen",
    "toggle",
  ])("a captured close cannot dismiss a replacement after %s", (replacement) => {
    const controller = createWorkbenchCommandPaletteController({ initialOpen: true });
    let closed = false;
    const close = controller.captureClose(() => {
      closed = true;
    });
    if (replacement === "another view") controller.open({ view: "theme" });
    else if (replacement === "close and reopen") {
      controller.close();
      controller.open();
    } else if (replacement === "toggle") {
      controller.toggle();
      controller.toggle();
    } else controller.open();

    close();

    expect(closed).toBe(false);
    expect(controller.isOpen()).toBe(true);
  });
});
