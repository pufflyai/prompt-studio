import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

// Guides whose code is copied from a maintained, tested example. A fenced block whose info
// string has `file=<path>` must equal that file in the example, and every source file of the
// example must appear in the guide, so a reader who copies each block gets the tested code.
export const DOCUMENTED_EXAMPLES = [
  { guide: "documentation/guides/extensions/0001-authoring.md", example: "infra/local/extensions/bookmarks" },
];

// Tests and installed or generated files are not part of what a reader types.
const NOT_DOCUMENTED = [/\.test\.ts$/, /(^|\/)bun\.lockb?$/, /(^|\/)CHANGELOG\.md$/];

interface Snippet {
  file: string;
  line: number;
  code: string;
}

const FENCE = /^(`{3,}|~{3,})\s*(\S*)(.*)$/;
const FILE_META = /(?:^|\s)file=(\S+)/;

export function annotatedSnippets(markdown: string) {
  const snippets: Snippet[] = [];
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const open = FENCE.exec(lines[index] ?? "");
    if (!open) continue;
    const [, fence = "", , meta = ""] = open;
    const end = lines.findIndex((line, at) => at > index && line.trim() === fence);
    if (end === -1) break;
    const file = FILE_META.exec(meta)?.[1];
    if (file) snippets.push({ file, line: index + 1, code: lines.slice(index + 1, end).join("\n") });
    index = end;
  }
  return snippets;
}

// Trailing spaces and the final newline do not change what a reader copies.
const normalize = (code: string) =>
  code
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

const firstDifference = (expected: string, actual: string) => {
  const want = expected.split("\n");
  const got = actual.split("\n");
  const at = want.findIndex((line, index) => line !== got[index]);
  const index = at === -1 ? want.length : at;
  return { line: index + 1, expected: want[index] ?? "(end of file)", actual: got[index] ?? "(end of block)" };
};

export function compareSnippets(guide: string, markdown: string, sources: Map<string, string>) {
  const problems: string[] = [];
  const snippets = annotatedSnippets(markdown);
  for (const snippet of snippets) {
    const source = sources.get(snippet.file);
    if (source === undefined) {
      problems.push(`${guide}:${snippet.line}: file=${snippet.file} is not a file in the example.`);
      continue;
    }
    if (normalize(source) === normalize(snippet.code)) continue;
    const difference = firstDifference(normalize(source), normalize(snippet.code));
    problems.push(
      `${guide}:${snippet.line}: the block for ${snippet.file} differs from the example at line ${difference.line}.\n` +
        `  example: ${difference.expected}\n  guide:   ${difference.actual}`,
    );
  }
  const shown = new Set(snippets.map((snippet) => snippet.file));
  for (const file of sources.keys()) {
    if (!shown.has(file)) problems.push(`${guide}: no file=${file} block shows this example file.`);
  }
  return problems;
}

async function exampleSources(root: string, directory = root, sources = new Map<string, string>()) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const file = relative(root, path).split("\\").join("/");
    if (entry.name === "node_modules" || NOT_DOCUMENTED.some((pattern) => pattern.test(file))) continue;
    if (entry.isDirectory()) await exampleSources(root, path, sources);
    if (entry.isFile()) sources.set(file, await readFile(path, "utf8"));
  }
  return sources;
}

export async function verifyDocsSnippets(root: string) {
  const problems: string[] = [];
  for (const { guide, example } of DOCUMENTED_EXAMPLES) {
    const markdown = await readFile(join(root, guide), "utf8");
    problems.push(...compareSnippets(guide, markdown, await exampleSources(join(root, example))));
  }
  return problems;
}

if (import.meta.main) {
  const problems = await verifyDocsSnippets(resolve(import.meta.dir, "../.."));
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) {
    console.error("\nCopy the example file into the guide, or change the example and its tests first.");
    process.exitCode = 1;
  } else {
    console.log(`Documentation snippets match ${DOCUMENTED_EXAMPLES.length} maintained example(s).`);
  }
}
