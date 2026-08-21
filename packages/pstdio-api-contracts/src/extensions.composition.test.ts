import { describe, expect, test } from "bun:test";
import {
  extensionCompositionPanelRecordSchema,
  extensionModeCompositionRecordSchema,
  extensionResourceKindRecordSchema,
  extensionResourcePanelRecordSchema,
  workbenchNavigationTargetSchema,
} from "./extensions";

describe("extension composition contracts", () => {
  test("round-trips resource slots, panel capabilities, and mode recipes in declaration order", () => {
    const resource = extensionResourceKindRecordSchema.parse({
      id: "planner.ticket",
      extensionId: "pstdio.planner",
      surface: "primary",
      slots: {
        primary: { cardinality: "one", external: false },
        inspector: { cardinality: "many", external: true },
      },
    });
    const panel = extensionCompositionPanelRecordSchema.parse({
      id: "insights.details",
      extensionId: "pstdio.insights",
      title: "Insights",
      show: { region: "side", allowedRegions: ["side", "secondary"] },
      renderer: { kind: "controls", id: "insights.details" },
    });
    const edge = extensionResourcePanelRecordSchema.parse({
      id: "insights.ticket-details",
      extensionId: "pstdio.insights",
      resourceKind: "planner.ticket",
      panel: "insights.details",
      slot: "inspector",
    });
    const mode = extensionModeCompositionRecordSchema.parse({
      resources: {
        "planner.ticket": {
          slots: { primary: { region: "main", required: true } },
          panels: { "insights.details": { region: "secondary", allowedRegions: ["secondary", "side"] } },
        },
      },
    });

    expect(Object.keys(resource.slots)).toEqual(["primary", "inspector"]);
    expect(panel.show).toEqual({ region: "side", allowedRegions: ["side", "secondary"] });
    expect(edge.slot).toBe("inspector");
    expect(Object.keys(mode.resources)).toEqual(["planner.ticket"]);
  });

  test("serializes navigation targets and rejects chrome regions", () => {
    expect(
      workbenchNavigationTargetSchema.parse({ modeId: "project", resource: { type: "ticket", id: "PS-266" } }),
    ).toEqual({ modeId: "project", resource: { type: "ticket", id: "PS-266" } });

    expect(
      extensionModeCompositionRecordSchema.safeParse({
        resources: { ticket: { slots: { primary: { region: "workbench.overlay" } } } },
      }).success,
    ).toBe(false);
  });
});
