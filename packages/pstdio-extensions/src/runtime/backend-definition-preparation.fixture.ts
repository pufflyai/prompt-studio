import { serialize } from "node:v8";
import { loadBackendDefinition } from "./backend-process/backend-workers";
import { definitionDigest } from "./backend-process/definition-cache";
import { startPreparationWorker } from "./preparation-server";

startPreparationWorker(async (task, input) => {
  if (task !== "definition" && task !== "inspect") return "ready";
  const { entryPath, id } = input as { entryPath: string; id: string };
  const definition = (
    await loadBackendDefinition(entryPath, {
      id,
      host: "definition-owner-fixture",
      entryPath,
      manifest: { id: "test.definition-owner" },
    })
  ).definition;
  return task === "inspect" ? { data: serialize(definition), digest: definitionDigest(definition) } : definition;
});
