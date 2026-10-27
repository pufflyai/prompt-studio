import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { canvases } from "../src/canvases/definitions";
import { collectStoryCatalog, extensionRoot, generatedRoot } from "./story-catalog";

test("the migration ledger retains every original design node, definition, and native preview provenance", async () => {
  const ledger = await Bun.file(resolve(generatedRoot, "migration-ledger.json")).json();
  expect(ledger.entries).toHaveLength(24496);
  expect(ledger.entries.filter((entry: { reusable: boolean }) => entry.reusable)).toHaveLength(292);
  expect(new Set(ledger.entries.map((entry: { key: string }) => entry.key)).size).toBe(24496);
  expect(ledger.files.flatMap((file: { roots: string[] }) => file.roots)).toHaveLength(159);
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

test("every owned migration image matches its recorded provenance", async () => {
  const ledger = await Bun.file(resolve(generatedRoot, "migration-ledger.json")).json();
  expect(ledger.assets).toHaveLength(10);
  for (const asset of ledger.assets) {
    const bytes = await Bun.file(resolve(extensionRoot, asset.destination)).arrayBuffer();
    expect(createHash("sha256").update(new Uint8Array(bytes)).digest("hex")).toBe(asset.sha256);
  }
});
