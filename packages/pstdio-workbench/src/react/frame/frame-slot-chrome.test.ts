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
    });
    expect(resolveSlotChrome("secondary")).toEqual({
      as: "section",
      headerVariant: "main",
      focus: { area: "panel", scope: "region" },
    });
  });

  test("uses the shared panel height for the classic main header", () => {
    expect(resolveSlotChrome("main-header")).toEqual({
      headerVariant: "main",
      growHeaderWhenEmpty: true,
    });
  });
});
