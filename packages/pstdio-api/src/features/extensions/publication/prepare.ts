import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isPreparationHost } from "pstdio-extensions";
import { runExtensionPreparation } from "../extension-preparation";
import { checkExtensionSource } from "../extension-runtime";
import { installDependencies } from "../install-extension-dependencies";
import { validateExtensionWebviews } from "../validate-extension-webviews";
import { unpackExtension } from "./package";

export type PreparePublishedInput = {
  bytes: Blob;
  root: string;
  extensionId: string;
  signal?: AbortSignal;
};
export const preparePublishedExtension = async (
  input: PreparePublishedInput,
): Promise<{
  path: string;
  loaded: NonNullable<Awaited<ReturnType<typeof checkExtensionSource>>["loaded"]>;
}> => {
  if (isPreparationHost) {
    const { signal, bytes, ...data } = input;
    return runExtensionPreparation("published.prepare", { ...data, bytes: await bytes.arrayBuffer() }, { signal });
  }
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
    await validateExtensionWebviews(loaded, path, loaded.metadata.name, input.signal);
    input.signal?.throwIfAborted();
    return { path, loaded };
  } catch (error) {
    await rm(path, { recursive: true, force: true });
    throw error;
  }
};
