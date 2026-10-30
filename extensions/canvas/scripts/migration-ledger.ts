import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canvases } from "../src/canvases/definitions";
import inventory from "../src/catalog/source-inventory.json";
import { generatedRoot } from "./story-catalog";

export const generateMigrationLedger = async () => {
  const stories = canvases.flatMap((canvas) =>
    canvas.items.flatMap((item) =>
      (item.variants ?? []).map((variant) => ({
        source: variant.preview.source,
        exportName: variant.preview.exportName,
        canvas: canvas.id,
        item: item.id,
        variant: variant.id,
      })),
    ),
  );
  const documents = canvases.flatMap((canvas) =>
    canvas.items.flatMap((item) =>
      item.preview?.kind === "document" ? [{ source: item.preview.source, canvas: canvas.id, item: item.id }] : [],
    ),
  );
  const factories: Record<string, string> = {
    "packages/pstdio-workbench/src/react/region/drop-feedback.canvas.tsx#createDropFeedbackWorkbench":
      "PreviewInsertion",
    "packages/pstdio-workbench/src/react/region/panel-arrangement.canvas.tsx#createArrangementWorkbench":
      "HeaderlessMain",
  };
  const inventoriedStories = inventory.exports.map((entry) => {
    const key = `${entry.source}#${entry.exportName}`;
    const shared = factories[key];
    const destination = stories.find(
      (binding) => binding.source === entry.source && binding.exportName === (shared ?? entry.exportName),
    );
    if (!destination) throw new Error(`Original source export has no destination: ${key}`);
    return { ...entry, destination, mapping: shared ? "shared" : "direct" };
  });
  const ledger = { schemaVersion: 2, inventoriedStories, stories, documents, native: inventory.native };
  await writeFile(resolve(generatedRoot, "migration-ledger.json"), `${JSON.stringify(ledger)}\n`);
  console.log(
    JSON.stringify({
      exports: stories.length,
      documents: documents.length,
      originalExports: inventoriedStories.length,
    }),
  );
  return ledger;
};
if (import.meta.main) await generateMigrationLedger();
