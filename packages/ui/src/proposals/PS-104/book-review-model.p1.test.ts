import { expect, test } from "bun:test";
import { reviewItems, unreadCounts } from "./book-review-model";
import { initialWorkflow } from "./book-workflow";

test("new review indicators clear only for items that have been read", () => {
  const state = initialWorkflow();
  const records = [
    ...reviewItems,
    ...state.observations.map((item) => ({ id: item.id, section: "Undocumented" as const })),
    ...state.suggestions.map((item) => ({ id: item.id, section: "Suggestions" as const })),
  ];
  expect(unreadCounts([], records)).toEqual({ Findings: 2, Undocumented: 1, Suggestions: 1 });
  const finding = reviewItems.find((item) => item.section === "Findings")!;
  expect(unreadCounts([finding.id], records)).toEqual({ Findings: 1, Undocumented: 1, Suggestions: 1 });
  expect(
    unreadCounts(
      records.map((item) => item.id),
      records,
    ),
  ).toEqual({ Findings: 0, Undocumented: 0, Suggestions: 0 });
});
