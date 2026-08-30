import { describe, expect, test } from "bun:test";
import {
  extensionCompositionPanelRecordSchema,
  extensionModeCompositionRecordSchema,
  extensionResourceKindRecordSchema,
  workbenchNavigationTargetSchema,
} from "./extensions";

describe("extension composition contracts", () => {
  test("round-trips menu slots, panel capabilities, and mode panel recipes in declaration order", () => {
    const resource = extensionResourceKindRecordSchema.parse({
      id: "planner.ticket",
      extensionId: "pstdio.planner",
      menuSlots: {
        header: { placement: "header-primary", external: false, order: 10 },
        more: { placement: "header-overflow", label: "Ticket actions", external: true },
      },
    });
    const panel = extensionCompositionPanelRecordSchema.parse({
      id: "insights.details",
      extensionId: "pstdio.insights",
      title: "Insights",
      show: { region: "side", allowedRegions: ["side", "secondary"] },
      renderer: { kind: "controls", id: "insights.details" },
    });
    const mode = extensionModeCompositionRecordSchema.parse({
      modePanels: { "insights.details": { region: "secondary", allowedRegions: ["secondary", "side"] } },
    });

    expect(Object.keys(resource.menuSlots)).toEqual(["header", "more"]);
    expect(resource.menuSlots.more).toEqual({
      placement: "header-overflow",
      label: "Ticket actions",
      external: true,
    });
    expect(panel.show).toEqual({ region: "side", allowedRegions: ["side", "secondary"] });
    expect(Object.keys(mode.modePanels ?? {})).toEqual(["insights.details"]);
  });

  test("serializes navigation targets and rejects chrome regions", () => {
    expect(
      workbenchNavigationTargetSchema.parse({ modeId: "project", resource: { type: "ticket", id: "PS-266" } }),
    ).toEqual({ modeId: "project", resource: { type: "ticket", id: "PS-266" } });

    expect(
      extensionModeCompositionRecordSchema.safeParse({
        modePanels: { "insights.details": { region: "workbench.overlay" } },
      }).success,
    ).toBe(false);
  });
});
