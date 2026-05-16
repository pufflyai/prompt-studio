import { describe, expect, test } from "bun:test";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createWorkbenchFocusController } from "./focus-controller";

describe("createWorkbenchFocusController", () => {
  test("derives workbench focus context keys from the active area", () => {
    const context = createContextKeyService();
    const focus = createWorkbenchFocusController({ context });

    focus.setActiveArea("sideBar");

    expect(context.snapshot()).toMatchObject({
      workbenchFocus: true,
      activeWorkbenchFocusArea: "sideBar",
      sideBarFocus: true,
      mainFocus: false,
      panelFocus: false,
    });

    focus.setActiveArea("main");

    expect(context.snapshot()).toMatchObject({
      workbenchFocus: true,
      activeWorkbenchFocusArea: "main",
      sideBarFocus: false,
      mainFocus: true,
      panelFocus: false,
    });

    focus.clearFocus();

    expect(context.snapshot()).toMatchObject({
      workbenchFocus: false,
      sideBarFocus: false,
      mainFocus: false,
      panelFocus: false,
    });
  });
});
