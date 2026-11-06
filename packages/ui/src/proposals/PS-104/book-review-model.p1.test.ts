import { expect, test } from "bun:test";
import { reviewItems, unreadCounts } from "./book-review-model";

test("new review indicators clear only for items that have been read", () => {
  expect(unreadCounts([])).toEqual({ Findings: 2, Undocumented: 1, Suggestions: 1 });
  const finding = reviewItems.find((item) => item.section === "Findings")!;
  expect(unreadCounts([finding.id])).toEqual({ Findings: 1, Undocumented: 1, Suggestions: 1 });
  expect(unreadCounts(reviewItems.map((item) => item.id))).toEqual({ Findings: 0, Undocumented: 0, Suggestions: 0 });
});
