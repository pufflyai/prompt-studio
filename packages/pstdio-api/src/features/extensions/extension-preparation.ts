import { Worker } from "node:worker_threads";
import { configureExtensionPreparationWorker, isPreparationHost, runExtensionPreparation } from "pstdio-extensions";
import type { hashExtensionSource } from "pstdio-extensions/authoring";
import { createPreparationClient } from "pstdio-extensions/preparation-client";
import { isPackagedRuntime } from "pstdio-paths";

const createWorker = () =>
  new Worker(
    new URL(
      isPackagedRuntime()
        ? "./packages/pstdio-api/src/features/extensions/extension-preparation-worker.js"
        : "./extension-preparation-worker.ts",
      import.meta.url,
    ),
  );
if (isPreparationHost)
  configureExtensionPreparationWorker(createWorker, async (homes) => {
    const cleanup = createPreparationClient(createWorker);
    try {
      for (const { home, env } of homes) await cleanup.run("lifecycle.cleanup", { env }, { home });
    } finally {
      await cleanup.stop();
    }
  });
export const hashExtensionSourceAsync = async (sourcePath: string) => {
  if (!isPreparationHost) {
    const { hashExtensionSource } = await import("pstdio-extensions/authoring");
    return hashExtensionSource(sourcePath);
  }
  return runExtensionPreparation<ReturnType<typeof hashExtensionSource>>("source.hash", { sourcePath });
};

export { runExtensionPreparation };
