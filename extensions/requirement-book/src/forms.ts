export const ruleFields = (test = "") => [
  { id: "title", label: "Title", type: "text" as const, required: true },
  { id: "statement", label: "Requirement", type: "longtext" as const, required: true },
  {
    id: "level",
    label: "Level",
    type: "select" as const,
    required: true,
    defaultValue: "2",
    options: [0, 1, 2, 3].map((level) => ({ value: String(level), label: `L${level}` })),
  },
  { id: "acceptance", label: "Acceptance", type: "longtext" as const },
  { id: "tests", label: "Test or result paths (one per line)", type: "longtext" as const, defaultValue: test },
  { id: "related", label: "Related requirements (comma-separated)", type: "text" as const },
  { id: "reason", label: "Reason for this change", type: "longtext" as const, required: true },
];
export const observationFields = [
  { id: "title", label: "Title", type: "text" as const, required: true },
  { id: "claim", label: "What is known", type: "longtext" as const, required: true },
  {
    id: "kind",
    label: "Evidence kind",
    type: "select" as const,
    options: [
      { value: "source", label: "Source" },
      { value: "assertion", label: "Assertion" },
      { value: "measurement", label: "Measurement" },
    ],
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
    label: "Finding type",
    type: "select" as const,
    options: [
      { value: "violation", label: "Violation" },
      { value: "potential-conflict", label: "Potential conflict" },
      { value: "missing-evidence", label: "Missing evidence" },
      { value: "stale-evidence", label: "Stale evidence" },
    ],
    required: true,
    defaultValue: "potential-conflict",
  },
  { id: "explanation", label: "Explanation and uncertainty", type: "longtext" as const, required: true },
  {
    id: "requirements",
    label: "Affected RB / RBE references (comma-separated)",
    type: "text" as const,
    required: true,
  },
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

export const chapterFields = [
  { id: "title", label: "Chapter title", type: "text" as const, required: true },
  {
    id: "group",
    label: "Group",
    type: "select" as const,
    required: true,
    defaultValue: "Core",
    options: [
      { value: "Core", label: "Core" },
      { value: "Extensions", label: "Extensions" },
    ],
  },
];

export const acceptanceConditions = (statement: unknown, tests: unknown) => {
  const text = String(statement ?? "").trim();
  const paths = splitLines(tests);
  if (!text && paths.length) throw new Error("Describe the acceptance condition for the linked tests.");
  return text ? [{ statement: text, tests: paths }] : [];
};
