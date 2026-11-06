export const ruleFields = (title: string, test = "") => [
  { id: "title", label: "Title", type: "text" as const, required: true },
  { id: "statement", label: "Requirement", type: "longtext" as const, required: true },
  { id: "scope", label: "Scope", type: "text" as const, required: true, defaultValue: title },
  { id: "level", label: "Level (0–3)", type: "text" as const, required: true, defaultValue: "2" },
  { id: "acceptance", label: "Acceptance", type: "longtext" as const, required: true },
  { id: "tests", label: "Test or result paths (one per line)", type: "longtext" as const, defaultValue: test },
  { id: "related", label: "Related requirements (comma-separated)", type: "text" as const },
  { id: "reason", label: "Reason for this change", type: "longtext" as const, required: true },
];
export const observationFields = [
  { id: "title", label: "Title", type: "text" as const, required: true },
  { id: "claim", label: "What is known", type: "longtext" as const, required: true },
  {
    id: "kind",
    label: "Evidence kind: source, assertion, or measurement",
    type: "text" as const,
    required: true,
    defaultValue: "assertion",
  },
  { id: "sources", label: "Source or result paths (one per line)", type: "longtext" as const, required: true },
  { id: "conditions", label: "Conditions and environment", type: "longtext" as const, required: true },
  { id: "limits", label: "Verification limits", type: "longtext" as const, required: true },
];
export const findingFields = [
  { id: "title", label: "Title", type: "text" as const, required: true },
  {
    id: "kind",
    label: "Type: violation, potential-conflict, missing-evidence, stale-evidence",
    type: "text" as const,
    required: true,
    defaultValue: "potential-conflict",
  },
  { id: "explanation", label: "Explanation and uncertainty", type: "longtext" as const, required: true },
  { id: "requirements", label: "Affected RB references (comma-separated)", type: "text" as const, required: true },
  { id: "evidence", label: "Inspectable evidence", type: "longtext" as const, required: true },
];
export const splitLines = (value: unknown) =>
  String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
export const splitRefs = (value: unknown) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
