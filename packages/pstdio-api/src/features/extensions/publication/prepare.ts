import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { checkExtensionSource } from "../extension-runtime";
import { buildExtensionWebview } from "../extension-webview-builder";
import { collectExtensionWebviews, resolvePackageAssetFile } from "../extension-webviews";
import { installDependencies } from "../install-extension-dependencies";
import { unpackExtension } from "./package";

export const packageRevision = async (bytes: Blob) =>
  createHash("sha256")
    .update(new Uint8Array(await bytes.arrayBuffer()))
    .digest("hex");

export const preparePublishedExtension = async (input: {
  bytes: Blob;
  root: string;
  extensionId: string;
  signal?: AbortSignal;
}) => {
  await mkdir(input.root, { recursive: true });
  const path = await mkdtemp(join(input.root, "revision-"));
  try {
    input.signal?.throwIfAborted();
    await unpackExtension(input.bytes, path);
    const manifest = await Bun.file(join(path, "package.json")).json();
    if (Object.keys(manifest.dependencies ?? {}).length > 0) {
      if (!(await Bun.file(join(path, "bun.lock")).exists()))
        throw new Error("Published extensions with runtime dependencies require bun.lock");
      await installDependencies(path, { production: true, signal: input.signal });
    }
    const { loaded, check } = await checkExtensionSource(path, dirname(path));
    if (!loaded || check.errorCount > 0)
      throw new Error(
        check.diagnostics.find((diagnostic) => diagnostic.severity === "error")?.message ?? "Invalid extension",
      );
    if (loaded.metadata.id !== input.extensionId) throw new Error("Published package identity mismatch");
    for (const [index, webview] of collectExtensionWebviews(loaded).entries()) {
      const result = await buildExtensionWebview({
        entryPath: resolvePackageAssetFile(webview.entry),
        outdir: join(path, ".pstdio", "validated-webviews", String(index)),
        signal: input.signal ?? new AbortController().signal,
      });
      if (!result.success) throw new Error(result.details);
    }
    input.signal?.throwIfAborted();
    return { path, loaded };
  } catch (error) {
    await rm(path, { recursive: true, force: true });
    throw error;
  }
};
