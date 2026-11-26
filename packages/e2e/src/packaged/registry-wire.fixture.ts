import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { basename } from "node:path";
import type { RegistryRelease } from "pstdio-extensions/distribution";
import { registryNotesEngines } from "./registry-notes.fixture";

// The portable smoke checks the host's HTTP contract. The service-container job runs
// the same scenario against the production PSX image with PostgreSQL and S3.
export const startRegistryWireFixture = async () => {
  const releases = new Map<string, RegistryRelease[]>();
  const packages = new Map<string, Buffer>();
  const runtimeBundles = new Map<string, Uint8Array>();
  const key = (id: string, version: string) => `${id}@${version}`;
  const register = (
    { id, version, enginesPstdio }: Pick<RegistryRelease, "id" | "version" | "enginesPstdio">,
    bytes: Buffer,
  ) => {
    const versions = releases.get(id) ?? [];
    versions.push({
      id,
      version,
      enginesPstdio,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      withdrawn: false,
    });
    releases.set(id, versions);
    packages.set(key(id, version), bytes);
  };
  const server = createServer((request, response) => {
    const match = /^\/api\/([^/]+)\/([^/]+)\/([^/]+)(?:\/(file|bundles)(?:\/([a-f0-9]{64}))?)?$/.exec(
      request.url ?? "",
    );
    if (!match) {
      response.writeHead(404).end("Not found");
      return;
    }
    const [, publisher, name, version, action, digest] = match;
    const id = `${publisher}.${name}`;
    if (version === "versions" && !action) {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ versions: releases.get(id) ?? [] }));
      return;
    }
    const bytes =
      action === "bundles" ? runtimeBundles.get(`${key(id, version!)}:${digest}`) : packages.get(key(id, version!));
    response.statusCode = bytes ? 200 : 404;
    response.end(bytes ?? "Not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Registry fixture has no address");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      const closed = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      server.closeAllConnections();
      await closed;
    },
    publishBundle: async (version: string, bytes: Uint8Array) => {
      const { inspectExtensionReleaseBundle } = await import("pstdio-extensions/distribution");
      const { descriptor, manifest } = await inspectExtensionReleaseBundle(bytes);
      const release = releases.get(manifest.extensionId)?.find((item) => item.version === version);
      if (!release || descriptor.sourceSha256 !== release.sha256 || manifest.version !== version)
        throw new Error("Bundle and release differ");
      release.bundles = [...(release.bundles ?? []), descriptor];
      runtimeBundles.set(`${key(release.id, version)}:${descriptor.sha256}`, bytes);
    },
    publish: async (path: string) => {
      const version = /^pstdio\.notes-(\d+\.\d+\.\d+)\.tgz$/.exec(basename(path))?.[1];
      if (!version) throw new Error("Unexpected Notes fixture package name");
      register({ id: "pstdio.notes", version, enginesPstdio: registryNotesEngines }, await readFile(path));
    },
    publishPackage: async (path: string) => {
      // Only the Bun benchmark uses the generic archive reader. Playwright runs on Node.
      const { readExtensionPackage } = await import("pstdio-extensions/distribution");
      const bytes = await readFile(path);
      const { manifest } = await readExtensionPackage(bytes);
      register(manifest, bytes);
    },
  };
};
