import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LoadedExtension } from "./extension-runtime";
import { inspectWebviewInputsForHost, prepareWebviewSourceForHost } from "./extension-webview-build-source";
import { buildExtensionWebview } from "./extension-webview-builder";
import { classifyWebviewEntry, collectExtensionWebviews, resolvePackageAssetFile } from "./extension-webviews";

export const validateExtensionWebviews = async (
  loaded: LoadedExtension,
  packagePath: string,
  installName: string,
  signal = new AbortController().signal,
) => {
  const views = collectExtensionWebviews(loaded).filter((view) => classifyWebviewEntry(view.entry).kind === "managed");
  if (!views.length) return;
  const root = await mkdtemp(join(tmpdir(), "pstdio-extension-build-check-"));
  try {
    for (const [index, view] of views.entries()) {
      signal.throwIfAborted();
      const input = {
        entryPath: resolvePackageAssetFile(view.entry),
        installName,
        packageName: loaded.metadata.name,
        packagePath,
      };
      const source = await prepareWebviewSourceForHost(
        {
          ...input,
          buildInputs: await inspectWebviewInputsForHost(input),
          shellDir: join(root, String(index), "source"),
        },
        signal,
      );
      if (!source.success) throw new Error(`Extension webview ${view.id} cannot activate: ${source.details}`);
      const outcome = await buildExtensionWebview({
        entryPath: source.entryPath,
        outdir: join(root, String(index), "dist"),
        signal,
      });
      if (!outcome.success) throw new Error(`Extension webview ${view.id} cannot activate: ${outcome.details}`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};
