import { expect, test } from "bun:test";
import { activityChangeSummary } from "./activity-presentation";

test("history describes the new value once using preserved human labels", () => {
  expect(
    activityChangeSummary({
      body: "Status changed",
      changes: [
        {
          field: "statusId",
          label: "Status",
          before: "backlog",
          after: "blocked",
          beforeLabel: "Backlog",
          afterLabel: "Blocked",
        },
      ],
    }),
  ).toBe("changed status to Blocked");
  expect(
    activityChangeSummary({ body: "Archived changed", changes: [{ field: "archived", before: false, after: true }] }),
  ).toBe("archived this resource");
  expect(activityChangeSummary({ body: "Imported history" })).toBe("Imported history");
});
