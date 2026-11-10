import { homedir as osHomedir } from "node:os";
import { join, resolve } from "node:path";
import { unpackExtension } from "pstdio-extensions/distribution";
import { expandHomePath } from "pstdio-paths";
import { isLocalExtensionSource } from "./extension-install-paths";
import { prepareNamedSource } from "./extension-source-checkout";
import type { InstallExtensionSourceInput } from "./install-extension-source-types";

const expandInstallSource = (path: string, homedir: () => string) =>
  path.startsWith("~\\") ? join(homedir(), path.slice(2)) : expandHomePath(path, homedir());
export const resolveInstallSource = async (input: InstallExtensionSourceInput, tempDir: string) => {
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
  if (input.registrySource) {
    const { createRegistryClient } = await import("pstdio-extensions/distribution");
    const { EXTENSION_API_VERSION } = await import("pstdio-api-contracts/extension-kernel");
    const client = createRegistryClient(input.registrySource.url);
    const release = await client.latest(input.registrySource.id, EXTENSION_API_VERSION, input.signal);
    const prepared = await client.prepare(release, join(tempDir, "package"), input.signal);
    return { kind: "named" as const, name: input.source, ...prepared };
  }
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
  return { kind: "named" as const, name: input.source, path: named.path, ref: named.ref };
};
