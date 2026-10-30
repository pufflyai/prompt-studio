import { execFileSync } from "node:child_process";

// Enforces two AGENTS.md rules on every PR: never commit generated files outside the listed
// exceptions, and get a person's approval before adding 2,000 or more lines.

// Paths that only a tool or build writes.
const GENERATED = [/(^|\/)generated\//, /(^|\/)dist\//, /(^|\/)storybook-static\//, /\.bundle\.js$/, /\.min\.js$/];

// AGENTS.md "Generated files" lists every exception; keep the two in sync.
const ALLOWED = [/^packages\/pstdio-extensions\/src\/bridge\/webview-runtime\/runtime\.bundle\.js$/];

export const LARGE_CHANGE_LINES = 2_000;
// Only a person adds this label, after approving the change's review request.
export const LARGE_CHANGE_LABEL = "large-change-approved";

interface Change {
  path: string;
  added: number;
}

type Problem = { rule: "generated-file"; path: string } | { rule: "large-change"; added: number };

export const checkPullRequestChanges = (input: { changes: Change[]; labels: string[] }) => {
  const problems: Problem[] = input.changes
    .filter(
      ({ path }) => GENERATED.some((pattern) => pattern.test(path)) && !ALLOWED.some((pattern) => pattern.test(path)),
    )
    .map(({ path }) => ({ rule: "generated-file", path }));
  const added = input.changes.reduce((total, change) => total + change.added, 0);
  if (added >= LARGE_CHANGE_LINES && !input.labels.includes(LARGE_CHANGE_LABEL))
    problems.push({ rule: "large-change", added });
  return problems;
};

// `git diff --numstat` prints "-" for binary files; they add no lines but still count as changes.
const readChanges = (base: string) =>
  execFileSync("git", ["diff", "--numstat", "--diff-filter=AMR", "--no-renames", `${base}...HEAD`], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [added = "0", , path = ""] = line.split("\t");
      return { path, added: added === "-" ? 0 : Number(added) };
    });

if (import.meta.main) {
  const base = process.env.BASE_SHA;
  if (!base) throw new Error("BASE_SHA is required");
  const labels = JSON.parse(process.env.PR_LABELS ?? "[]") as string[];
  const problems = checkPullRequestChanges({ changes: readChanges(base), labels });
  for (const problem of problems) {
    if (problem.rule === "generated-file")
      console.error(
        `::error file=${problem.path}::Generated file. Remove it from the PR; see AGENTS.md "Generated files".`,
      );
    else
      console.error(
        `::error::This PR adds ${problem.added} lines. Changes of ${LARGE_CHANGE_LINES}+ lines need a person's approval through a review request, then the "${LARGE_CHANGE_LABEL}" label; see AGENTS.md "Large changes".`,
      );
  }
  if (problems.length > 0) process.exit(1);
  console.log("No generated files, and the change size is within the limit or approved.");
}
