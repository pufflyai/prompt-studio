import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { planHash } from "./test-plan";

export const testPlanSource = (root: string) => {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const files = git("ls-files", "scripts/ci", "packages/*/package.json", "extensions/*/package.json")
    .split("\n")
    .filter(Boolean);
  const diff = git("diff", "HEAD", "--binary");
  const untracked = git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
  const dirty = Boolean(diff || untracked.length);
  return {
    sha: git("rev-parse", "HEAD"),
    tree: dirty
      ? planHash([
          git("rev-parse", "HEAD^{tree}"),
          diff,
          untracked.map((file) => {
            const path = join(root, file);
            return [
              file,
              lstatSync(path).isSymbolicLink() ? readlinkSync(path) : readFileSync(path).toString("base64"),
            ];
          }),
        ])
      : git("rev-parse", "HEAD^{tree}"),
    policy: planHash(
      files.map((file) => {
        try {
          return [file, readFileSync(join(root, file), "utf8")];
        } catch {
          return [file, null];
        }
      }),
    ),
    dirty,
  };
};
export const testExecutionId = () =>
  process.env.CI_TEST_EXECUTION_ID ??
  (process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}/${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`
    : `local-${process.pid}-${Date.now()}`);
