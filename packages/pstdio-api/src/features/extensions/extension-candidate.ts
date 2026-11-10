import { dirname } from "node:path";
import { runExtensionPreparation } from "./extension-preparation";
import { checkExtensionSource, loadExtensionSource } from "./extension-runtime";
import { validateExtensionWebviews } from "./validate-extension-webviews";

export const checkCandidateSource = async (sourcePath: string) => {
  const result = await runExtensionPreparation<Awaited<ReturnType<typeof checkExtensionSource>>>("source.validate", {
    sourcePath,
  });
  if (result.check.errorCount === 0 && result.loaded?.preparedRevision)
    result.loaded = await loadExtensionSource(sourcePath, { preparedRevision: result.loaded.preparedRevision });
  return result;
};

export const validateCandidateInWorker = async (input: { sourcePath: string }, signal: AbortSignal) => {
  const result = await checkExtensionSource(input.sourcePath, dirname(input.sourcePath));
  if (result.loaded && result.check.errorCount === 0)
    await validateExtensionWebviews(result.loaded, input.sourcePath, result.loaded.metadata.name, signal);
  return JSON.parse(JSON.stringify(result)) as typeof result;
};
