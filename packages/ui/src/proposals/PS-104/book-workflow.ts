import { chapters, findRule, initialRules, type Rule, saveRule } from "./book-model";

export interface Operation {
  type: "ADD" | "AMEND" | "REMOVE" | "MOVE";
  before: Rule | null;
  after: Rule | null;
}
export interface Suggestion {
  id: string;
  title: string;
  reason: string;
  operations: Operation[];
  evidence: string[];
  reviewed: boolean;
  applied: boolean;
}
export interface Observation {
  id: string;
  title: string;
  claim: string;
  kind: string;
  revision: string;
  conditions: string;
  limits: string;
  requirements: string[];
}
export interface Workflow {
  branch: Rule[];
  suggestions: Suggestion[];
  observations: Observation[];
  readIds: string[];
  nextId: number;
}

const same = (left: Rule | undefined | null, right: Rule | undefined | null) =>
  JSON.stringify(left) === JSON.stringify(right);

export const initialWorkflow = () => {
  const note = findRule(initialRules, "RB 11.A.1")!;
  const moving = findRule(initialRules, "RB 11.A.2")!;
  const removing = findRule(initialRules, "RB 11.A.4")!;
  const state: Workflow = {
    branch: initialRules,
    nextId: 101,
    readIds: [],
    observations: [
      {
        id: "O-1",
        title: "Page opening has a 200 ms assertion",
        claim: "An illustrative test declares a 200 ms opening threshold.",
        kind: "Test assertion",
        revision: "Sample revision a14c082",
        conditions: "Synthetic fixture; workload and device are unspecified.",
        limits: "No executed result is attached. This is not an accepted product budget or a compliance verdict.",
        requirements: [],
      },
    ],
    suggestions: [
      {
        id: "S-1",
        title: "Make editing and recovery expectations explicit",
        reason:
          "Review persistence behavior and its verification together. All changes and references in this prototype are illustrative.",
        evidence: ["F-1"],
        reviewed: false,
        applied: false,
        operations: [
          {
            type: "AMEND",
            before: note,
            after: {
              ...note,
              statement:
                "Keep local editing responsive while saving work. Choose and review the persistence policy explicitly.",
              acceptance: [
                {
                  statement:
                    "Verify editing responsiveness and recovery under a documented workload; no new timing budget is implied.",
                  tests: note.acceptance[0].tests,
                },
              ],
            },
          },
          {
            type: "ADD",
            before: null,
            after: {
              ...note,
              ref: "RB 11.A.100",
              title: "Explain save-policy tradeoffs",
              statement:
                "Review persistence frequency, responsiveness, and recovery implications together before changing the save policy.",
              related: [note.ref],
            },
          },
          { type: "MOVE", before: moving, after: { ...moving, chapter: 8 } },
          { type: "REMOVE", before: removing, after: null },
        ],
      },
    ],
  };
  return state;
};

const projectOperations = (rules: Rule[], operations: Operation[]) =>
  operations.reduce((current, operation) => {
    if (operation.type === "REMOVE") return current.filter((rule) => rule.ref !== operation.before?.ref);
    return operation.after ? saveRule(current, operation.after) : current;
  }, rules);

const targetIssues = (rules: Rule[], operation: Operation) => {
  const ref = operation.after?.ref ?? operation.before?.ref ?? "";
  if (operation.type === "ADD") {
    const issues = [];
    if (findRule(rules, ref)) issues.push(`${ref} already exists.`);
    if (!operation.after || operation.before) issues.push(`${ref}: invalid ADD.`);
    return issues;
  }
  if (!operation.before) return [`${ref}: missing prior content.`];
  const issues = [];
  if (!same(findRule(rules, operation.before.ref), operation.before))
    issues.push(`${ref} changed on the working branch. Reconcile its comparison.`);
  if (operation.type !== "REMOVE" && operation.after?.ref !== operation.before.ref)
    issues.push(`${ref}: preserve its identity.`);
  if (
    operation.type === "MOVE" &&
    !same(operation.before, operation.after && { ...operation.after, chapter: operation.before.chapter })
  )
    issues.push(`${ref}: MOVE must preserve content.`);
  return issues;
};

const ruleIssues = (rules: Rule[], rule: Rule) => {
  const issues = [];
  if (
    !rule.title.trim() ||
    !rule.statement.trim() ||
    !rule.scope.trim() ||
    !rule.acceptance.length ||
    rule.acceptance.some((item) => !item.statement.trim())
  )
    issues.push(`${rule.ref}: complete the required content.`);
  if (![0, 1, 2, 3].includes(rule.level)) issues.push(`${rule.ref}: choose L0–L3.`);
  if (!chapters.some((chapter) => chapter.id === rule.chapter)) issues.push(`${rule.ref}: unknown chapter.`);
  for (const related of rule.related)
    if (!findRule(rules, related) || related === rule.ref) issues.push(`${rule.ref}: unresolved reference ${related}.`);
  return issues;
};

export const operationIssues = (rules: Rule[], operations: Operation[]) => {
  const issues = operations.flatMap((operation) => targetIssues(rules, operation));
  const targets = new Set<string>();
  for (const operation of operations) {
    const ref = operation.after?.ref ?? operation.before?.ref ?? "";
    if (targets.has(ref)) issues.push(`${ref} has overlapping operations.`);
    targets.add(ref);
  }
  const projected = projectOperations(rules, operations);
  return [...new Set([...issues, ...projected.flatMap((rule) => ruleIssues(projected, rule))])];
};

const getSuggestion = (state: Workflow, id: string) => {
  const suggestion = state.suggestions.find((item) => item.id === id);
  if (!suggestion) throw new Error("Suggestion not found.");
  if (suggestion.applied) throw new Error("This suggestion is already applied.");
  return suggestion;
};
const assertCurrent = (state: Workflow, suggestion: Suggestion) => {
  const issues = operationIssues(state.branch, suggestion.operations);
  if (issues.length) throw new Error(issues.join(" "));
};

export const stageSuggestion = (state: Workflow, title: string, operations: Operation[], evidence: string[] = []) => ({
  ...state,
  nextId: state.nextId + 1,
  suggestions: [
    ...state.suggestions,
    {
      id: `S-${state.nextId}`,
      title,
      reason: "Proposed book change. Inspect its exact effects before applying to a working branch.",
      operations,
      evidence,
      reviewed: false,
      applied: false,
    },
  ],
});

export const reviewSuggestion = (state: Workflow, id: string) => {
  assertCurrent(state, getSuggestion(state, id));
  return {
    ...state,
    suggestions: state.suggestions.map((item) => (item.id === id ? { ...item, reviewed: true } : item)),
  };
};

export const applySuggestion = (state: Workflow, id: string) => {
  const suggestion = getSuggestion(state, id);
  assertCurrent(state, suggestion);
  const branch = projectOperations(state.branch, suggestion.operations);
  return {
    ...state,
    branch,
    observations: state.observations.map((item) => ({
      ...item,
      requirements: item.requirements.filter((ref) => findRule(branch, ref)),
    })),
    suggestions: state.suggestions.map((item) => (item.id === id ? { ...item, applied: true } : item)),
  };
};

// The caller explicitly chooses to keep the proposed content against the displayed current version.
export const reconcileSuggestion = (state: Workflow, id: string) => {
  const suggestion = getSuggestion(state, id);
  const operations = suggestion.operations.map((operation) => {
    if (operation.type === "ADD") return operation;
    const before = findRule(state.branch, operation.before!.ref);
    if (!before) throw new Error("The target was removed. Discard this draft and prepare a new change.");
    const after = operation.type === "MOVE" ? { ...before, chapter: operation.after!.chapter } : operation.after;
    return { ...operation, before, after };
  });
  const issues = operationIssues(state.branch, operations);
  if (issues.length) throw new Error(issues.join(" "));
  return {
    ...state,
    suggestions: state.suggestions.map((item) => (item.id === id ? { ...item, operations, reviewed: false } : item)),
  };
};

export const removalOperations = (rules: Rule[], target: Rule): Operation[] => [
  { type: "REMOVE", before: target, after: null },
  ...rules
    .filter((rule) => rule.related.includes(target.ref))
    .map((before) => ({
      type: "AMEND" as const,
      before,
      after: { ...before, related: before.related.filter((ref) => ref !== target.ref) },
    })),
];

export const mapObservation = (state: Workflow, id: string, ref: string) => {
  if (!findRule(state.branch, ref)) throw new Error("Choose an existing rule.");
  return {
    ...state,
    observations: state.observations.map((item) =>
      item.id === id
        ? {
            ...item,
            requirements: item.requirements.includes(ref)
              ? item.requirements.filter((target) => target !== ref)
              : [...item.requirements, ref],
          }
        : item,
    ),
  };
};

export const promoteObservation = (state: Workflow, id: string) => {
  const observation = state.observations.find((item) => item.id === id);
  if (!observation) throw new Error("Observation not found.");
  const rule: Rule = {
    ref: `RB 19.A.${state.nextId}`,
    chapter: 19,
    level: 3,
    scope: "Performance evidence",
    section: "Contracts",
    title: "Qualify opening-time evidence",
    statement:
      "Opening-time claims identify the workload, environment, revision, and whether evidence is an assertion or executed measurement.",
    acceptance: [
      { statement: "A test assertion without an executed result remains explicitly unverified.", tests: [] },
    ],
    related: ["RB 19.A.1"],
  };
  return stageSuggestion(state, "Propose a rule from observation", [{ type: "ADD", before: null, after: rule }], [id]);
};
