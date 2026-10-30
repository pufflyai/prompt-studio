import { execFileSync } from "node:child_process";

// Enforces the AGENTS.md rule "Generated files": never commit generated files outside the listed exceptions.

// Paths that only a tool or build writes.
const GENERATED = [/(^|\/)generated\//, /(^|\/)dist\//, /(^|\/)storybook-static\//, /\.bundle\.js$/, /\.min\.js$/];

// AGENTS.md "Generated files" lists every exception; keep the two in sync.
const ALLOWED = [/^packages\/pstdio-extensions\/src\/bridge\/webview-runtime\/runtime\.bundle\.js$/];

export const findGeneratedFiles = (paths: string[]) =>
  paths.filter(
    (path) => GENERATED.some((pattern) => pattern.test(path)) && !ALLOWED.some((pattern) => pattern.test(path)),
  );

const readChangedPaths = (base: string) =>
  execFileSync("git", ["diff", "--name-only", "--diff-filter=AMR", "--no-renames", `${base}...HEAD`], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);

if (import.meta.main) {
  const base = process.env.BASE_SHA;
  if (!base) throw new Error("BASE_SHA is required");
  const generated = findGeneratedFiles(readChangedPaths(base));
  for (const path of generated)
    console.error(`::error file=${path}::Generated file. Remove it from the PR; see AGENTS.md "Generated files".`);
  if (generated.length > 0) process.exit(1);
  console.log("No generated files outside the AGENTS.md exceptions.");
}
