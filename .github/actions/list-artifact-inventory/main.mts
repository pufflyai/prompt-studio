import { writeFileSync } from "node:fs";
import { getResultsContext } from "../download-artifact-by-id/results.mts";
import { listArtifactInventory } from "./inventory.mts";

try {
  const results = getResultsContext();
  if (!results) throw new Error("Actions Results is unavailable on this runner");
  const names = process.env.INPUT_NAMES?.split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names?.length || !process.env.INPUT_PATH) throw new Error("Artifact names and an inventory path are required");
  const inventory = await listArtifactInventory({}, results, names);
  writeFileSync(process.env.INPUT_PATH, `${JSON.stringify(inventory, null, 2)}\n`);
} catch (error) {
  console.log(`::error::${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
