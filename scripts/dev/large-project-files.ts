// Runs inside an isolated stack's container, in the demo project's folder (`bun -e`).
// Writes only missing files and commits whatever is still uncommitted, so a rerun resumes.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const count = Number(process.env.LARGE_PROJECT_FILES);
if (!Number.isInteger(count) || count < 1) throw new Error("LARGE_PROJECT_FILES must be a positive whole number");
const root = "large-project";

const source = (index: number) => {
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

for (let index = 0; index < count; index++) {
  const directory = `${root}/area-${String(index % 50).padStart(2, "0")}/module-${String(Math.floor(index / 50) % 20).padStart(2, "0")}`;
  const isNote = index % 10 === 0;
  const path = `${directory}/${isNote ? "notes" : "file"}-${String(index).padStart(5, "0")}.${isNote ? "md" : "ts"}`;
  if (existsSync(path)) continue;
  mkdirSync(directory, { recursive: true });
  writeFileSync(path, isNote ? note(index) : source(index));
}

if (execFileSync("git", ["status", "--porcelain", "--", root], { encoding: "utf8" }).trim()) {
  execFileSync("git", ["add", "--", root]);
  execFileSync("git", [
    "-c",
    "user.name=Prompt Studio",
    "-c",
    "user.email=dev@prompt.studio",
    "commit",
    "--quiet",
    "-m",
    `Add ${count} large-project files`,
  ]);
}
console.log(JSON.stringify({ files: count }));
