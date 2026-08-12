import { describe, expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../core";
import { resolveDisplayedActiveWidgetId, suppressesSidenavTabStrip, toTabKey } from "./region-tabs-visibility";

const placement = (overrides: Partial<WorkbenchWidgetPlacement>): WorkbenchWidgetPlacement => ({
  widgetId: overrides.widgetId ?? "w",
  contributionId: overrides.contributionId ?? "c",
  ...overrides,
});

describe("toTabKey", () => {
  test("composes region and contribution into the storage key", () => {
    expect(toTabKey("main", placement({ contributionId: "tickets" }))).toBe("main:tickets");
  });
});

describe("suppressesSidenavTabStrip", () => {
  test("suppresses the strip for a lone pinned, non-closable sidenav panel", () => {
    expect(suppressesSidenavTabStrip("sidenav", [placement({ pinned: true, closable: false })])).toBe(true);
  });

  test("keeps the strip when the sidenav panel is closable", () => {
    expect(suppressesSidenavTabStrip("sidenav", [placement({ pinned: true, closable: true })])).toBe(false);
  });

  test("keeps the strip when the sidenav shows multiple panels", () => {
    expect(
      suppressesSidenavTabStrip("sidenav", [
        placement({ widgetId: "w1", pinned: true }),
        placement({ widgetId: "w2", pinned: true }),
      ]),
    ).toBe(false);
  });

  test("never suppresses outside the sidenav region", () => {
    expect(suppressesSidenavTabStrip("side", [placement({ pinned: true, closable: false })])).toBe(false);
  });
});

describe("resolveDisplayedActiveWidgetId", () => {
  const visible = [
    placement({ widgetId: "w1", contributionId: "a" }),
    placement({ widgetId: "w2", contributionId: "b" }),
  ];

  test("returns activeWidgetId if it is in the visible set", () => {
    expect(resolveDisplayedActiveWidgetId(visible, "w2")).toBe("w2");
  });

  test("falls back to first visible when activeWidgetId is no longer visible", () => {
    expect(resolveDisplayedActiveWidgetId(visible, "wOther")).toBe("w1");
  });

  test("falls back to first visible when activeWidgetId is undefined", () => {
    expect(resolveDisplayedActiveWidgetId(visible, undefined)).toBe("w1");
  });

  test("returns undefined when the visible set is empty", () => {
    expect(resolveDisplayedActiveWidgetId([], "w2")).toBeUndefined();
  });
});
