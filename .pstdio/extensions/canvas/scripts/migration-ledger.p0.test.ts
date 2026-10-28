import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { canvases } from "../src/canvases/definitions";
import { collectStoryCatalog, generatedRoot } from "./story-catalog";

test("the source ledger retains every original scenario and native preview destination", async () => {
  const ledger = await Bun.file(resolve(generatedRoot, "migration-ledger.json")).json();
  expect(ledger.native).toHaveLength(14);
  expect(ledger.inventoriedStories).toHaveLength(1569);
  for (const entry of ledger.inventoriedStories) {
    expect(
      canvases
        .find((canvas) => canvas.id === entry.destination.canvas)
        ?.items.some((item) => item.id === entry.destination.item),
    ).toBe(true);
  }
  for (const binding of [
    ...ledger.native.filter((entry: { removed?: string }) => !entry.removed),
    ...ledger.stories,
    ...ledger.documents,
  ]) {
    expect(
      canvases.find((canvas) => canvas.id === binding.canvas)?.items.some((item) => item.id === binding.item),
    ).toBe(true);
    if (binding.variant) {
      expect(
        canvases
          .find((canvas) => canvas.id === binding.canvas)
          ?.items.find((item) => item.id === binding.item)
          ?.variants?.some((variant) => variant.id === binding.variant),
      ).toBe(true);
    }
  }
  const current = await collectStoryCatalog();
  expect(
    ledger.stories.map((story: { source: string; exportName: string }) => `${story.source}#${story.exportName}`).sort(),
  ).toEqual(current.stories.map((story) => `${story.source}#${story.exportName}`).sort());
  expect(ledger.documents.map((document: { source: string }) => document.source).sort()).toEqual(
    current.documents.map((document) => document.source).sort(),
  );
});
