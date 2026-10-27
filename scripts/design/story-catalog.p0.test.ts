import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectStoryCatalog, generatedRoot } from "./story-catalog";

test("every exported story and documentation page is reachable from UI Canvas", async () => {
  const source = await collectStoryCatalog();
  const generated = JSON.parse(await readFile(resolve(generatedRoot, "stories.json"), "utf8"));
  const identities = (stories: { source: string; exportName: string }[]) =>
    stories.map((story) => `${story.source}#${story.exportName}`).sort();
  expect(identities(generated.stories)).toEqual(identities(source.stories));
  expect(generated.documents.map((document: { source: string }) => document.source).sort()).toEqual(
    source.documents.map((document) => document.source).sort(),
  );
  expect(new Set(generated.stories.map((story: { id: string }) => story.id)).size).toBe(source.stories.length);
});
