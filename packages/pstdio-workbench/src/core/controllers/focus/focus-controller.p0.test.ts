import { describe, expect, test } from "bun:test";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createWorkbenchFocusController } from "./focus-controller";

describe("createWorkbenchFocusController", () => {
  test("derives workbench focus context keys from the active region", () => {
    const context = createContextKeyService();
    const focus = createWorkbenchFocusController({ context });

    focus.setActiveRegion("sidenav");

    expect(context.snapshot()).toMatchObject({
      workbenchFocus: true,
      activeWorkbenchFocusRegion: "sidenav",
      sidenavFocus: true,
      mainFocus: false,
      secondaryFocus: false,
      sideFocus: false,
    });

    focus.setActiveRegion("main");

    expect(context.snapshot()).toMatchObject({
      workbenchFocus: true,
      activeWorkbenchFocusRegion: "main",
      sidenavFocus: false,
      mainFocus: true,
      secondaryFocus: false,
      sideFocus: false,
    });

    focus.clearFocus();

    expect(context.snapshot()).toMatchObject({
      workbenchFocus: false,
      sidenavFocus: false,
      mainFocus: false,
      secondaryFocus: false,
      sideFocus: false,
    });
  });

  test("tracks Secondary and Side Panel focus as distinct logical roles", () => {
    const context = createContextKeyService();
    const focus = createWorkbenchFocusController({ context });

    focus.setActiveRegion("secondary");
    expect(context.snapshot()).toMatchObject({
      activeWorkbenchFocusRegion: "secondary",
      secondaryFocus: true,
      sideFocus: false,
    });

    focus.setActiveRegion("side");
    expect(context.snapshot()).toMatchObject({
      activeWorkbenchFocusRegion: "side",
      secondaryFocus: false,
      sideFocus: true,
    });
  });
});
