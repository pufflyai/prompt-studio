import { describe, expect, test } from "bun:test";
import { createSavedViewRegistry } from "../../../core";
import { createTicketSavedViewKind } from "./ticket-saved-view-kind";
import { filtersToExpression, settingsToDisplay } from "./ticket-view-mapping";

describe("createTicketSavedViewKind", () => {
  test("accepts the ticket display fields used by dashboard saved views", async () => {
    const savedViews = createSavedViewRegistry();
    savedViews.registerKind(createTicketSavedViewKind());

    const view = await savedViews.create({
      name: "Current workbench tickets",
      resourceKind: "ticket",
      scope: "project",
      projectId: "dashboard-example",
      filter: filtersToExpression({ status: ["review"] }),
      display: settingsToDisplay({
        viewMode: "board",
        columnGrouping: "status",
        rowGrouping: "none",
        ordering: { field: "updated", direction: "desc" },
        displayProperties: ["id", "status", "updated"],
      }),
    });

    expect(view.invalid).toBeUndefined();
  });
});
