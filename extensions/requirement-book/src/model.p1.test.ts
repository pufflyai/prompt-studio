import { describe, expect, test } from "bun:test";
import {
  applyOperations,
  type Book,
  bookSchema,
  createRuleReference,
  operationIssues,
  parseBook,
  reconcileOperations,
  serializeBook,
} from "./model";
import { bookFixture } from "./model.fixture";

describe("repository requirement changes", () => {
  test("applies ADD AMEND MOVE REMOVE without changing the input revision", () => {
    const book = bookFixture();
    const [a, b, c] = book.rules;
    const added = { ...a, ref: "RB 1.A.4", title: "Fourth" };
    const operations = [
      { type: "AMEND" as const, before: a, after: { ...a, statement: "New statement" } },
      { type: "ADD" as const, before: null, after: added },
      { type: "MOVE" as const, before: b, after: { ...b, chapter: 2 } },
      { type: "REMOVE" as const, before: c, after: null },
    ];
    const changed = applyOperations(book, operations);
    expect(changed.rules.map((x) => x.ref)).toEqual([a.ref, b.ref, added.ref]);
    expect(changed.rules[0].statement).toBe("New statement");
    expect(changed.rules[1].chapter).toBe(2);
    expect(changed.retired).toContain(c.ref);
    expect(book.rules).toEqual([a, b, c]);
  });
  test("rejects stale targets, retired references, bad levels and broken relationships", () => {
    const book = bookFixture();
    const before = book.rules[0];
    expect(() =>
      applyOperations({ ...book, rules: [{ ...before, statement: "new" }, ...book.rules.slice(1)] }, [
        { type: "AMEND", before, after: { ...before, title: "Edit" } },
      ]),
    ).toThrow("changed");
    expect(() =>
      applyOperations({ ...book, retired: ["RB 1.A.4"] }, [
        { type: "ADD", before: null, after: { ...before, ref: "RB 1.A.4" } },
      ]),
    ).toThrow("retired");
    expect(bookSchema.safeParse({ ...book, rules: [{ ...before, level: 4 }] }).success).toBe(false);
    expect(
      operationIssues(book, [{ type: "AMEND", before, after: { ...before, related: ["RB 999.A.1"] } }]).join(" "),
    ).toContain("reference");
  });
  test("unrelated changes do not stale a target and reconciliation preserves identity", () => {
    const book = bookFixture();
    const before = book.rules[0];
    const operations = [{ type: "AMEND" as const, before, after: { ...before, statement: "Proposed" } }];
    const branch = { ...book, rules: book.rules.map((r, i) => (i === 1 ? { ...r, title: "Other edit" } : r)) };
    expect(operationIssues(branch, operations)).toEqual([]);
    const changed = { ...branch, rules: [{ ...before, statement: "Current" }, ...branch.rules.slice(1)] };
    const reconciled = reconcileOperations(changed, operations);
    expect(reconciled[0].before?.statement).toBe("Current");
    expect(reconciled[0].after?.ref).toBe(before.ref);
    expect(applyOperations(changed, reconciled).rules[0].statement).toBe("Proposed");
  });
});

test("stored suggestions remain applicable after record storage reorders object keys", () => {
  const book = bookFixture();
  const before = book.rules[0];
  const reordered = Object.fromEntries(Object.entries(before).sort(([a], [b]) => a.localeCompare(b))) as typeof before;
  expect(
    operationIssues(book, [{ type: "AMEND", before: reordered, after: { ...reordered, title: "Changed" } }]),
  ).toEqual([]);
});

test("extension rules use RBE and keep relationships and identities when moved within extensions", () => {
  const book: Book = bookFixture();
  book.chapters.push({ id: 3, title: "Planner", group: "Extensions" });
  book.chapters.push({ id: 4, title: "Reports", group: "Extensions" });
  expect(createRuleReference(book.chapters[2])).toMatch(/^RBE 3\.A\.[a-f0-9]+$/);
  const extension = { ...book.rules[0], chapter: 3, ref: "RBE 3.A.1", governing: [book.rules[0].ref] };
  const added = applyOperations(book, [{ type: "ADD", before: null, after: extension }]);
  const moved = applyOperations(added, [{ type: "MOVE", before: extension, after: { ...extension, chapter: 4 } }]);
  expect(parseBook(serializeBook(moved)).rules.at(-1)).toEqual({ ...extension, chapter: 4 });
  expect(() =>
    applyOperations(book, [{ type: "ADD", before: null, after: { ...extension, ref: "RB 3.A.1" } }]),
  ).toThrow("RBE");
  expect(() =>
    applyOperations(added, [{ type: "MOVE", before: extension, after: { ...extension, chapter: 1 } }]),
  ).toThrow("RB");
});

test("a rule needs its statement and identity without a separate scope entry", () => {
  const book = bookFixture();
  const rule = { ...book.rules[0], acceptance: [] };
  delete (rule as { scope?: string }).scope;
  expect(() => parseBook(serializeBook({ ...book, rules: [rule] }))).not.toThrow();
});
