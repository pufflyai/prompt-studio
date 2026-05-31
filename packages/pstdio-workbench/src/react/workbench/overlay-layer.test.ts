import { describe, expect, test } from "bun:test";
import { resolveOverlayDialogConfig, resolveOverlayDialogRenderState } from "./overlay-layer";

describe("resolveOverlayDialogConfig", () => {
  test("disables dialog close interactions for placements that are not closeable", () => {
    expect(
      resolveOverlayDialogConfig(
        { closable: false },
        {
          closeOnEscape: true,
          closeOnInteractOutside: true,
        },
      ),
    ).toMatchObject({
      closeOnEscape: false,
      closeOnInteractOutside: false,
    });
  });

  test("allows escape and background close behavior to be configured separately", () => {
    expect(
      resolveOverlayDialogConfig(
        { closable: true },
        {
          closeOnEscape: false,
          closeOnInteractOutside: true,
        },
      ),
    ).toMatchObject({
      closeOnEscape: false,
      closeOnInteractOutside: true,
    });

    expect(
      resolveOverlayDialogConfig(
        { closable: true },
        {
          closeOnEscape: true,
          closeOnInteractOutside: false,
        },
      ),
    ).toMatchObject({
      closeOnEscape: true,
      closeOnInteractOutside: false,
    });
  });

  test("keeps current close defaults explicit for closeable overlays", () => {
    expect(resolveOverlayDialogConfig({ closable: true }, undefined)).toMatchObject({
      closeOnEscape: true,
      closeOnInteractOutside: true,
    });
  });
});

describe("resolveOverlayDialogRenderState", () => {
  const placement = {
    widgetId: "dashboard-workbench.project-picker",
    contributionId: "dashboard-workbench.project-picker",
    title: "Projects",
    closable: true,
  };

  test("keeps a dismissed placement mounted as closed until the dialog exit completes", () => {
    expect(resolveOverlayDialogRenderState(undefined, placement)).toEqual({
      open: false,
      placement,
    });
  });

  test("prefers the active placement when an overlay reopens while a close is settling", () => {
    const activePlacement = { ...placement, title: "Projects reopened" };

    expect(resolveOverlayDialogRenderState(activePlacement, placement)).toEqual({
      open: true,
      placement: activePlacement,
    });
  });
});
