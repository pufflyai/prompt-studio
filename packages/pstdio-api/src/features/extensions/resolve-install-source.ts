import { homedir as osHomedir } from "node:os";
import { join, resolve } from "node:path";
import { registrySourceRef, releaseBundleHost, unpackExtension } from "pstdio-extensions/distribution";
import { expandHomePath } from "pstdio-paths";
import { isLocalExtensionSource } from "./extension-install-paths";
import { prepareNamedSource } from "./extension-source-checkout";
import type { InstallExtensionSourceInput, PreparedNamedInstallSource } from "./install-extension-source-types";
import { readWarmedExtensionRelease } from "./prepared-release-bundle";

const expandInstallSource = (path: string, homedir: () => string) =>
  path.startsWith("~\\") ? join(homedir(), path.slice(2)) : expandHomePath(path, homedir());
type ResolvedInstallSource =
  | ({ kind: "named"; name: string } & PreparedNamedInstallSource)
  | { kind: "local"; path: string; ref?: string };

const resolveRegistrySource = async (
  input: InstallExtensionSourceInput,
  source: NonNullable<InstallExtensionSourceInput["registrySource"]>,
  tempDir: string,
): Promise<ResolvedInstallSource> => {
  const { createRegistryClient } = await import("pstdio-extensions/distribution");
  const { EXTENSION_API_VERSION } = await import("pstdio-api-contracts/extension-kernel");
  const client = createRegistryClient(source.url);
  const release = source.release ?? (await client.latest(source.id, EXTENSION_API_VERSION, input.signal));
  const descriptor =
    !input.skipRuntimeBundle &&
    release.bundles?.find((bundle) => bundle.host === releaseBundleHost() && bundle.sourceSha256 === release.sha256);
  const warmed = descriptor && (await readWarmedExtensionRelease(descriptor, release));
  if (warmed) {
    const ref = registrySourceRef({
      registry: source.url.replace(/\/$/, ""),
      id: release.id,
      version: release.version,
    });
    return { kind: "named" as const, name: input.source, ref, ...warmed };
  }
  const path = join(tempDir, "runtime.tgz");
  const [sourceResult, bundleResult] = await Promise.allSettled([
    client.prepare(release, join(tempDir, "package"), input.signal),
    descriptor &&
      client.downloadBundle(release, descriptor, input.signal).then(async (bytes) => {
        await Bun.write(path, bytes);
        return { path, descriptor, sourceSha256: release.sha256 };
      }),
  ]);
  // Both writers have left the staging directory before a caller can clean it up.
  if (sourceResult.status === "rejected") throw sourceResult.reason;
  if (bundleResult.status === "rejected") throw bundleResult.reason;
  const prepared = sourceResult.value;
  const runtimeBundle = bundleResult.value;
  return { kind: "named" as const, name: input.source, ...prepared, runtimeBundle: runtimeBundle || undefined };
};

export const resolveInstallSource = async (
  input: InstallExtensionSourceInput,
  tempDir: string,
): Promise<ResolvedInstallSource> => {
  if (input.preparedSource) return { kind: "named" as const, name: input.source, ...input.preparedSource };
  if (input.originSource) {
    const { prepareGitExtensionSource, prepareReleaseExtensionSource } = await import("./extension-source-checkout");
    const prepare = input.originSource.kind === "git" ? prepareGitExtensionSource : prepareReleaseExtensionSource;
    const prepared = await prepare(
      input.originSource.origin,
      tempDir,
      input.ref ?? input.originSource.origin.ref,
      input.signal,
    );
    return { kind: "named" as const, name: input.source, ...prepared };
  }
  if (input.registrySource) return resolveRegistrySource(input, input.registrySource, tempDir);
  const homedir = input.homedir ?? osHomedir;
  if (isLocalExtensionSource(input.source)) {
    const path = resolve(expandInstallSource(input.source, homedir));
    if (path.endsWith(".tgz")) {
      const target = join(tempDir, "package");
      await unpackExtension(await Bun.file(path).bytes(), target);
      return { kind: "local" as const, path: target, ref: path };
    }
    return { kind: "local" as const, path, ref: undefined };
  }

  const named = await (input.prepareNamedSource ?? prepareNamedSource)(
    input.source,
    tempDir,
    input.ref,
    input.signal,
    input.hostReleaseRef,
  );
  return { kind: "named" as const, name: input.source, ...named };
};
