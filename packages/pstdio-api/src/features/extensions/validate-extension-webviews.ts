import { isPreparationHost } from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";
import type { LoadedExtension } from "./extension-runtime";
import { classifyWebviewEntry, collectExtensionWebviews, resolveWebviewSourceEntry } from "./extension-webviews";
import { prepareWebviewArtifacts } from "./prepared-webview";

export const validateExtensionWebviews = async (
  loaded: LoadedExtension,
  packagePath: string,
  installName: string,
  signal = new AbortController().signal,
) => {
  const views = collectExtensionWebviews(loaded).filter((view) => classifyWebviewEntry(view.entry).kind === "managed");
  if (loaded.preparedRevision) loaded.preparedRevision.webviews = {};
  const inputs = views.map((view) => ({
    entryPath: resolveWebviewSourceEntry(view.entry, packagePath, loaded.preparedRevision?.packagePath),
    installName,
    packageName: loaded.metadata.name,
    packagePath,
  }));
  try {
    const artifacts = isPreparationHost
      ? await runExtensionPreparation<Awaited<ReturnType<typeof prepareWebviewArtifacts>>>(
          "webview.artifacts",
          inputs,
          { signal },
        )
      : await prepareWebviewArtifacts(inputs, signal);
    for (const [index, view] of views.entries())
      if (loaded.preparedRevision) {
        const artifact = artifacts[index]!;
        loaded.preparedRevision.webviews![view.id] = { id: artifact.id, distDir: artifact.distDir };
      }
  } catch (error) {
    throw new Error(`Extension webviews cannot activate: ${error instanceof Error ? error.message : String(error)}`);
  }
};
