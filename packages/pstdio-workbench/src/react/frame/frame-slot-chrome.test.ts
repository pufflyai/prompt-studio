import { describe, expect, test } from "bun:test";
import { resolveSlotChrome } from "./frame-slot-chrome";

describe("resolveSlotChrome", () => {
  test("uses generic region chrome for unknown slots", () => {
    expect(resolveSlotChrome("inspector")).toEqual({ headerVariant: "main" });
  });

  test("preserves the classic main and secondary focus boundaries", () => {
    expect(resolveSlotChrome("main")).toEqual({
      headerVariant: "main",
      focus: { area: "main", scope: "content" },
      growHeaderWhenEmpty: true,
    });
    expect(resolveSlotChrome("secondary")).toEqual({
      as: "section",
      headerVariant: "main",
      focus: { area: "panel", scope: "region" },
    });
  });

  test("maps classic shell slots to their frame renderers", () => {
    expect(resolveSlotChrome("activity")).toMatchObject({ as: "nav", renderer: "activity" });
    expect(resolveSlotChrome("nav")).toMatchObject({ renderer: "nav" });
    expect(resolveSlotChrome("side")).toMatchObject({ as: "aside", renderer: "side" });
    expect(resolveSlotChrome("status")).toMatchObject({ as: "footer", renderer: "status" });
  });

  test("keeps the classic left header full bleed", () => {
    expect(resolveSlotChrome("left")).toEqual({
      as: "aside",
      headerVariant: "main",
      headerLayout: "full-bleed",
      focus: { area: "sideBar", scope: "region" },
    });
  });
});
