export const ruleFields = () => [
  { id: "title", label: "Title", type: "text" as const, required: true },
  { id: "statement", label: "Requirement", type: "longtext" as const, required: true },
  { id: "acceptance", label: "Acceptance", type: "longtext" as const },
  { id: "related", label: "Related requirements (comma-separated)", type: "text" as const },
  { id: "reason", label: "Reason for this change", type: "longtext" as const, required: true },
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

export const acceptanceConditions = (value: unknown) =>
  splitLines(value).map((statement) => ({ statement: statement.replace(/^[-*]\s+/, ""), tests: [] as string[] }));

export const draftChapterFor = (mode: "rule" | "finding" | "chapter", chapter: number) =>
  ({ rule: chapter, finding: -2, chapter: -3 })[mode];
