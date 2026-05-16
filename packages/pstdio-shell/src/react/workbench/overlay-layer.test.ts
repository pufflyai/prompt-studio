import { describe, expect, test } from "bun:test";
import { resolveOverlayDialogConfig } from "./overlay-layer";

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
