import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { annotatedSnippets, compareSnippets, verifyDocsSnippets } from "./verify-docs-snippets";

const fence = "```";
const guide = (blocks: string[]) => ["# Guide", "", ...blocks, ""].join("\n");
const block = (meta: string, code: string) => `${fence}${meta}\n${code}\n${fence}\n`;

test("reads only fenced blocks that name an example file", () => {
  const markdown = guide([
    block("sh", "bun install"),
    block("ts file=src/commands.ts", "export const a = 1;"),
    block("json file=package.json", '{ "name": "bookmarks" }'),
  ]);

  expect(annotatedSnippets(markdown)).toEqual([
    { file: "src/commands.ts", line: 7, code: "export const a = 1;" },
    { file: "package.json", line: 11, code: '{ "name": "bookmarks" }' },
  ]);
});

test("accepts blocks that match their example files", () => {
  const sources = new Map([["extension.ts", "export default {};\n"]]);

  expect(compareSnippets("guide.md", guide([block("ts file=extension.ts", "export default {};  ")]), sources)).toEqual(
    [],
  );
});

test("reports a block that drifted from its example file", () => {
  const sources = new Map([["src/commands.ts", "const a = 1;\nconst b = 2;\n"]]);

  expect(
    compareSnippets("guide.md", guide([block("ts file=src/commands.ts", "const a = 1;\nconst b = 3;")]), sources),
  ).toEqual([
    "guide.md:3: the block for src/commands.ts differs from the example at line 2.\n" +
      "  example: const b = 2;\n  guide:   const b = 3;",
  ]);
});

test("reports example files the guide does not show and blocks without a file", () => {
  const sources = new Map([
    ["extension.ts", "export default {};"],
    ["src/view.ts", "export const view = {};"],
  ]);

  expect(
    compareSnippets(
      "guide.md",
      guide([block("ts file=extension.ts", "export default {};"), block("ts file=src/old.ts", "")]),
      sources,
    ),
  ).toEqual([
    "guide.md:7: file=src/old.ts is not a file in the example.",
    "guide.md: no file=src/view.ts block shows this example file.",
  ]);
});

test("the published authoring guide shows the maintained Bookmarks example", async () => {
  expect(await verifyDocsSnippets(resolve(import.meta.dir, "../.."))).toEqual([]);
});
