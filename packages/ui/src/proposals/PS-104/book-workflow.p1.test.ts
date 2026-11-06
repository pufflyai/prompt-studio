import { describe, expect, test } from "bun:test";
import { findRule, initialRules } from "./book-model";
import {
  applySuggestion,
  initialWorkflow,
  mapObservation,
  operationIssues,
  promoteObservation,
  reconcileSuggestion,
  removalOperations,
  reviewSuggestion,
  stageSuggestion,
} from "./book-workflow";

describe("requirement book prototype workflow", () => {
  test("drafting and local review leave both repository revisions unchanged", () => {
    const state = initialWorkflow();
    const before = state.branch[0];
    const draft = stageSuggestion(state, "Change a rule", [
      { type: "AMEND", before, after: { ...before, statement: "Proposed intent" } },
    ]);
    const reviewed = reviewSuggestion(draft, draft.suggestions.at(-1)!.id);
    expect(reviewed.branch).toEqual(initialRules);
    expect(initialRules[0]).toEqual(before);
    expect(reviewed.suggestions.at(-1)?.reviewed).toBe(true);
  });

  test("one bundle applies all four operations only to the working revision", () => {
    const state = initialWorkflow();
    const suggestion = state.suggestions[0];
    expect(suggestion.operations.map((operation) => operation.type)).toEqual(["AMEND", "ADD", "MOVE", "REMOVE"]);
    const applied = applySuggestion(state, suggestion.id);
    const [amend, add, move, remove] = suggestion.operations;
    expect(findRule(applied.branch, amend.after!.ref)).toEqual(amend.after!);
    expect(findRule(applied.branch, add.after!.ref)).toEqual(add.after!);
    expect(findRule(applied.branch, move.after!.ref)).toEqual(move.after!);
    expect(findRule(applied.branch, remove.before!.ref)).toBeUndefined();
    expect(findRule(initialRules, remove.before!.ref)).toEqual(remove.before!);
    expect(applied.suggestions[0].applied).toBe(true);
  });

  test("changed targets require explicit reconciliation and invalidate prior review", () => {
    const state = initialWorkflow();
    const reviewed = reviewSuggestion(state, state.suggestions[0].id);
    const target = reviewed.suggestions[0].operations[0].before!;
    const changed = {
      ...reviewed,
      branch: reviewed.branch.map((rule) =>
        rule.ref === target.ref ? { ...rule, statement: "New branch intent" } : rule,
      ),
    };
    expect(() => applySuggestion(changed, state.suggestions[0].id)).toThrow("changed");
    expect(() => reviewSuggestion(changed, state.suggestions[0].id)).toThrow("changed");
    const reconciled = reconcileSuggestion(changed, state.suggestions[0].id);
    expect(reconciled.suggestions[0].reviewed).toBe(false);
    expect(reconciled.suggestions[0].operations[0].before?.statement).toBe("New branch intent");
    expect(applySuggestion(reconciled, state.suggestions[0].id).suggestions[0].applied).toBe(true);
  });

  test("mapping retains qualified evidence and unmapping restores the observation", () => {
    const state = initialWorkflow();
    const observation = state.observations[0];
    const first = mapObservation(state, observation.id, initialRules[0].ref);
    const second = mapObservation(first, observation.id, initialRules[1].ref);
    expect(second.observations[0].requirements).toEqual([initialRules[0].ref, initialRules[1].ref]);
    expect(second.observations[0].kind).toBe("Test assertion");
    expect(second.observations[0].limits).toBe(observation.limits);
    const undone = mapObservation(
      mapObservation(second, observation.id, initialRules[0].ref),
      observation.id,
      initialRules[1].ref,
    );
    expect(undone.observations[0].requirements).toEqual([]);
  });

  test("promotion drafts an ADD with evidence without accepting a product budget", () => {
    const state = initialWorkflow();
    const promoted = promoteObservation(state, state.observations[0].id);
    expect(promoted.branch).toEqual(state.branch);
    const suggestion = promoted.suggestions.at(-1)!;
    expect(suggestion.operations[0].type).toBe("ADD");
    expect(suggestion.evidence).toEqual([state.observations[0].id]);
    expect(state.observations[0].requirements).toEqual([]);
  });

  test("removal explicitly includes amendments for incoming links", () => {
    const rule = initialRules[0];
    const linked = { ...initialRules[1], related: [rule.ref] };
    const operations = removalOperations([rule, linked], rule);
    expect(operations.map((operation) => operation.type)).toEqual(["REMOVE", "AMEND"]);
    expect(operations[1].before?.related).toEqual([rule.ref]);
    expect(operations[1].after?.related).toEqual([]);
  });

  test("duplicate additions, invalid levels and unresolved references cannot apply", () => {
    const state = initialWorkflow();
    expect(operationIssues(state.branch, [{ type: "ADD", before: null, after: initialRules[0] }]).join(" ")).toContain(
      "exists",
    );
    const invalid = { ...initialRules[0], ref: "RB 1.A.200", level: 4, related: ["RB 99.A.1"] };
    expect(operationIssues(state.branch, [{ type: "ADD", before: null, after: invalid }]).length).toBeGreaterThan(0);
  });
});
