export const bookFixture = () => ({
  version: 1 as const,
  chapters: [
    { id: 1, title: "Workspaces", group: "Core" as const },
    { id: 2, title: "Sessions", group: "Core" as const },
  ],
  rules: [1, 2, 3].map((n) => ({
    ref: `RB 1.A.${n}`,
    chapter: 1,
    level: 2,
    scope: "Local workspaces",
    title: `Rule ${n}`,
    statement: "Preserve user work.",
    rationale: "",
    status: "accepted" as const,
    section: "Behavior",
    acceptance: [{ statement: "Existing work remains accessible.", tests: [] }],
    related: [] as string[],
    governing: [] as string[],
  })),
  retired: [] as string[],
});
