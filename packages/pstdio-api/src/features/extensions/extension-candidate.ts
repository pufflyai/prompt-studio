import { dirname } from "node:path";
import { prepareExtensionRevision } from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";
import { checkExtensionSource, type LoadedExtension, loadExtensionSource } from "./extension-runtime";
import { validateExtensionWebviews } from "./validate-extension-webviews";

// The worker inspects contributions; only the accepting host imports their live callbacks.
export const inspectCandidateSource = async (sourcePath: string) =>
  runExtensionPreparation<LoadedExtension>("source.inspect", { sourcePath });

export const checkCandidateSource = async (sourcePath: string) => {
  const result = await runExtensionPreparation<Awaited<ReturnType<typeof checkExtensionSource>>>("source.validate", {
    sourcePath,
  });
  if (result.check.errorCount === 0 && result.loaded?.preparedRevision)
    result.loaded = await loadExtensionSource(sourcePath, { preparedRevision: result.loaded.preparedRevision });
  return result;
};

const inspections = new Map<string, { id: string; loaded: LoadedExtension }>();
export const inspectCandidateInWorker = async (input: { sourcePath: string }) => {
  const revision = await prepareExtensionRevision(input.sourcePath);
  const cached = inspections.get(input.sourcePath);
  if (cached?.id === revision.id) return cached.loaded;
  const loaded = JSON.parse(
    JSON.stringify(await loadExtensionSource(input.sourcePath, { preparedRevision: revision })),
  ) as LoadedExtension;
  inspections.set(input.sourcePath, { id: revision.id, loaded });
  return loaded;
};

export const validateCandidateInWorker = async (input: { sourcePath: string }, signal: AbortSignal) => {
  const result = await checkExtensionSource(input.sourcePath, dirname(input.sourcePath));
  if (result.loaded && result.check.errorCount === 0)
    await validateExtensionWebviews(result.loaded, input.sourcePath, result.loaded.metadata.name, signal);
  return JSON.parse(JSON.stringify(result)) as typeof result;
};
