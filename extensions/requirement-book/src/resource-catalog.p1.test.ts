import { expect, test } from "bun:test";
import { bookFixture } from "./model.fixture";
import { resourceEntries, resourceSelection, resourceSpecs } from "./resource-catalog";

test("book resources have distinct identities and navigate to their own content", () => {
  const book = bookFixture();
  const data = {
    chapters: book.chapters,
    rules: book.rules,
    findings: [{ id: "finding", title: "Review gap", requirements: [book.rules[0].ref], resolved: true }],
    observations: [
      { id: "evidence", title: "Source reading", claim: "Inspected source", requirements: [book.rules[0].ref] },
    ],
    suggestions: [
      {
        id: "suggestion",
        title: "Amend rule",
        reason: "Clarify behavior",
        operations: [{ before: book.rules[0], after: null }],
      },
    ],
  };
  expect(new Set(resourceSpecs.map((spec) => spec.icon)).size).toBe(5);
  for (const [type, id, section] of [
    ["requirement", book.rules[0].ref, null],
    ["chapter", "2", null],
    ["finding", "finding", "Findings"],
    ["observation", "evidence", "Undocumented"],
    ["suggestion", "suggestion", "Suggestions"],
  ] as const) {
    expect(resourceEntries(data, type).some((entry) => entry.id === id)).toBe(true);
    expect(resourceSelection(data, { type, id }, { chapter: 99 }).section).toBe(section);
    expect(resourceSelection(data, { type, id }, { chapter: 99 }).chapter).toBe(type === "chapter" ? 2 : 1);
  }
  expect(resourceEntries(data, "finding")[0].label).toBe("Review gap");
});

test("extension chapter and rule resources expose the RBE namespace", () => {
  const book = bookFixture();
  const data = {
    ...book,
    chapters: [{ id: 3, title: "Planner", group: "Extensions" as const }],
    rules: [{ ...book.rules[0], chapter: 3, ref: "RBE 3.A.1" }],
    findings: [],
    observations: [],
    suggestions: [],
  };
  expect(resourceEntries(data, "chapter")[0].label).toBe("RBE3 Planner");
  expect(resourceEntries(data, "requirement")[0].id).toBe("RBE 3.A.1");
  expect(resourceSelection(data, { type: "requirement", id: "RBE 3.A.1" }, {}).chapter).toBe(3);
});
