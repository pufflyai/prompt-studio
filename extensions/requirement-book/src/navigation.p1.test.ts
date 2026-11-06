import { expect, test } from "bun:test";
import { bookFixture } from "./model.fixture";
import { ruleSelectionTarget, ruleTarget } from "./targets";

test("rule navigation retains book and chapter breadcrumbs for each selected rule", () => {
  const chapter = { id: 16, title: "Planner", group: "Extensions" as const };
  const first = ruleTarget("RBE 16.A.1", "Create tickets", "project", chapter);
  const next = ruleTarget("RBE 16.A.2", "Update tickets", "project", chapter);
  expect(first.resource.id).toBe("RBE 16.A.1");
  expect(next.resource.id).toBe("RBE 16.A.2");
  expect(next.parent.resource.id).toBe("16");
  expect(next.parent.resource.label).toBe("RBE16 Planner");
  expect(next.parent.parent.page.id).toBe("book");
});

test("selecting another rule replaces the current viewer instead of mounting another document", () => {
  const book = bookFixture();
  const source = { type: "requirement", id: book.rules[0].ref };
  const target = ruleSelectionTarget(book.rules[1], book.chapters[0], "project", book.rules[0], source);
  expect(target.kind).toBe("viewer");
  if (target.kind !== "viewer") throw new Error("Expected viewer replacement");
  expect(target.operation).toBe("replace");
  expect(target.from).toBe(source);
  expect(target.resource.id).toBe(book.rules[1].ref);
  expect(ruleSelectionTarget(book.rules[1], book.chapters[0], "project").kind).toBe("page");
});
