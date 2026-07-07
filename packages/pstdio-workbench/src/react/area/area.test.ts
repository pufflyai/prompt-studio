import { describe, expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../core";
import { resolveRenderedAreaPlacements } from "./area";

const placement = (overrides: Partial<WorkbenchWidgetPlacement>): WorkbenchWidgetPlacement => ({
  widgetId: overrides.widgetId ?? "widget",
  contributionId: overrides.contributionId ?? "contribution",
  ...overrides,
});

describe("resolveRenderedAreaPlacements", () => {
  test("keeps inactive keep-mounted placements in the render set", () => {
    const active = placement({ widgetId: "active" });
    const inactiveTerminal = placement({ widgetId: "terminal", mountStrategy: "keep-mounted" });
    const inactivePlain = placement({ widgetId: "plain" });

    expect(resolveRenderedAreaPlacements([active, inactiveTerminal, inactivePlain], "active")).toEqual([
      active,
      inactiveTerminal,
    ]);
  });
});
