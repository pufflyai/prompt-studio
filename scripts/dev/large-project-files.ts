// Writes a large, committed source tree into a project folder. Only missing files are written and
// only uncommitted changes are committed, so a rerun resumes.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "large-project";

const git = (folder: string, ...args: string[]) => {
  const result = spawnSync(
    "git",
    [
      ...["-c", "user.name=Prompt Studio", "-c", "user.email=dev@prompt.studio", "-c", "init.defaultBranch=main"],
      // Global signing or hooks must not prompt or fail inside a generated fixture repository.
      ...["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null"],
      ...args,
    ],
    { cwd: folder, encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${folder}: ${result.stderr}`);
  return result.stdout;
};

const source = (index: number, count: number) => {
  const name = `Module${index}`;
  const lines = [
    `// Generated for large-project checks. File ${index + 1} of ${count}.`,
    `export interface ${name}Options {`,
    "  id: string;",
    "  label: string;",
    "  weight: number;",
    "}",
    "",
    `export const create${name} = (options: ${name}Options) => ({`,
    "  ...options,",
    `  key: \`${index}:\${options.id}\`,`,
    "  score: options.weight * 2,",
    "});",
    "",
  ];
  for (let step = 0; step < 6; step++)
    lines.push(
      `export const ${name.toLowerCase()}Step${step} = (value: number) => value * ${step + 1} + ${index % 97};`,
    );
  return `${lines.join("\n")}\n`;
};

const note = (index: number) =>
  `# Notes ${index + 1}\n\n${"This generated note gives search, previews and diffs realistic text to work through. ".repeat(12)}\n`;

/** Makes `folder` a Git repository holding `count` committed files under large-project/. */
export const writeLargeProjectFiles = (folder: string, count: number) => {
  mkdirSync(folder, { recursive: true });
  if (!existsSync(join(folder, ".git"))) git(folder, "init", "--quiet");
  for (let index = 0; index < count; index++) {
    const directory = join(
      folder,
      ROOT,
      `area-${String(index % 50).padStart(2, "0")}`,
      `module-${String(Math.floor(index / 50) % 20).padStart(2, "0")}`,
    );
    const isNote = index % 10 === 0;
    const path = join(
      directory,
      `${isNote ? "notes" : "file"}-${String(index).padStart(5, "0")}.${isNote ? "md" : "ts"}`,
    );
    if (existsSync(path)) continue;
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, isNote ? note(index) : source(index, count));
  }
  if (git(folder, "status", "--porcelain", "--", ROOT).trim()) {
    git(folder, "add", "--", ROOT);
    git(folder, "commit", "--quiet", "-m", `Add ${count} large-project files`);
  }
};
