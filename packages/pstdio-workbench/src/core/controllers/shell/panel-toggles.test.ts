import { describe, expect, test } from "bun:test";
import { resolvePanelToggles, resolveStatusBarVisible } from "./panel-toggles";

const policy = { provided: true, canToggle: true, open: true };
const policies = { sidenav: policy, secondary: policy, side: policy };

describe("panel toggles follow resolved placement", () => {
  test.each([
    [{}, ["sidenav", "secondary", "side"]],
    [{ side: { edge: "left" } }, ["sidenav", "side", "secondary"]],
    [{ sidenav: { edge: "right" } }, ["secondary", "side", "sidenav"]],
    [{ side: { edge: "left" }, sidenav: { edge: "right" } }, ["side", "secondary", "sidenav"]],
  ] as const)("orders %j from left to right", (regions, expected) => {
    expect(resolvePanelToggles({ regions, policies }).map((toggle) => toggle.region)).toEqual([...expected]);
  });

  test("uses the current edge for Side and Secondary icons", () => {
    const toggles = resolvePanelToggles({
      regions: { side: { edge: "left" }, secondary: { edge: "top" } },
      policies,
    });
    expect(toggles.map((toggle) => toggle.icon)).toEqual(["ListTree", "PanelLeft", "PanelTop"]);
  });

  test("keeps Navigation available while open and omits forbidden toggles", () => {
    expect(
      resolvePanelToggles({
        regions: {},
        policies: { ...policies, secondary: { ...policy, canToggle: false }, side: { ...policy, provided: false } },
      }),
    ).toEqual([{ region: "sidenav", icon: "ListTree", label: "Hide Navigation", open: true }]);
  });
});

describe("status bar visibility", () => {
  test.each([
    [undefined, 0, 0, false],
    [undefined, 1, 0, true],
    [undefined, 0, 1, true],
    ["mode.status", 0, 0, true],
    ["mode.status", 0, 1, true],
    [false, 1, 0, false],
    [false, 0, 1, true],
  ] as const)("resolves chrome %s, items %i and toggles %i", (chrome, items, toggles, visible) => {
    expect(resolveStatusBarVisible(chrome, items, toggles)).toBe(visible);
  });
});
