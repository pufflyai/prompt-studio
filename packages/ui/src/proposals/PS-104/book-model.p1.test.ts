import { describe, expect, test } from "bun:test";
import { filterPaletteEntries } from "../../components/command-palette/palette-filter";
import { chapters, findRule, initialRules, removeRule, ruleSearchEntries, saveRule } from "./book-model";

describe("requirement book resources", () => {
  test("global search finds references and content across chapters", () => {
    const entries = ruleSearchEntries(initialRules);
    expect(filterPaletteEntries(entries, { query: "RB 11.A.2" }).map((entry) => entry.id)).toEqual(["RB 11.A.2"]);
    expect(filterPaletteEntries(entries, { query: "interrupted" }).length).toBeGreaterThan(0);
  });
  test("creation and editing update the same searchable records", () => {
    const original = findRule(initialRules, "RB 1.A.1")!;
    const created = { ...original, ref: "RB 1.A.100", title: "Recover a workspace" };
    const added = saveRule(initialRules, created);
    const edited = saveRule(added, { ...created, title: "Restore a workspace" });
    expect(edited.filter((rule) => rule.ref === created.ref)).toHaveLength(1);
    expect(filterPaletteEntries(ruleSearchEntries(edited), { query: "Restore a workspace" })).toHaveLength(1);
  });
  test("removal clears search results and linked references", () => {
    const target = initialRules[0];
    const linked = { ...initialRules[1], related: [target.ref] };
    const remaining = removeRule(saveRule(initialRules, linked), target.ref);
    expect(findRule(remaining, target.ref)).toBeUndefined();
    expect(findRule(remaining, linked.ref)?.related).toEqual([]);
    expect(filterPaletteEntries(ruleSearchEntries(remaining), { query: target.ref })).toHaveLength(0);
  });
  test("every feature chapter has acceptance linked to tests", () => {
    for (const chapter of chapters) {
      expect(initialRules.some((rule) => rule.chapter === chapter.id)).toBe(true);
      expect(
        initialRules
          .filter((rule) => rule.chapter === chapter.id)
          .every((rule) => rule.acceptance.every((condition) => condition.tests.length)),
      ).toBe(true);
    }
  });
});
