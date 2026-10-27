import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import type { DesignDocument, DesignNode } from "../src/catalog/pencil/model";
import { generatedRoot } from "./story-catalog";

// This checks the retained RP-1 evidence. It makes no claim about current Pencil source freshness.
test("design references retain every inventoried node, root, override, and asset", async () => {
  const catalog = await Bun.file(resolve(generatedRoot, "designs.json")).json();
  const ledger = await Bun.file(resolve(generatedRoot, "migration-ledger.json")).json();
  const nodes = new Map(ledger.entries.map((node: { key: string; propertiesHash: string }) => [node.key, node]));
  let checked = 0;
  for (const file of catalog) {
    const evidence = ledger.files.find((entry: { source: string }) => entry.source === file.source);
    expect(file.hash).toBe(evidence.sha256);
    const { default: packed } = await import(resolve(generatedRoot, `${file.id}-design.ts`));
    const document = JSON.parse(gunzipSync(Buffer.from(packed, "base64")).toString()) as DesignDocument;
    expect(file.roots.map((root: { id: string }) => root.id)).toEqual(evidence.roots);
    expect(document.variables).toEqual(evidence.variables);
    expect(document.themes).toEqual(evidence.themes);
    const walk = (children: DesignNode[]) => {
      for (const node of children) {
        const { children: nested, ...properties } = node;
        const entry = nodes.get(`${file.source}#${node.id}`) as { propertiesHash: string };
        expect(entry).toBeDefined();
        expect(createHash("sha256").update(JSON.stringify(properties)).digest("hex")).toBe(entry.propertiesHash);
        checked += 1;
        walk(nested ?? []);
      }
    };
    walk(document.children);
    for (const data of Object.values(document.assets ?? {})) {
      const bytes = Buffer.from(data.split(",")[1], "base64");
      const hash = createHash("sha256").update(bytes).digest("hex");
      expect(ledger.assets.some((asset: { sha256: string }) => asset.sha256 === hash)).toBe(true);
    }
  }
  expect(checked).toBe(24496);
});
