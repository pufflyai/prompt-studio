import { supportsExtensionApiVersion } from "pstdio-api-contracts/extension-kernel";
import { z } from "zod";
import { MAX_EXTENSION_PACKAGE_BYTES, unpackExtension } from "./package";

export class ExtensionRegistryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ExtensionRegistryError";
  }
}

const identity = z.string().regex(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/);
const version = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const releaseSchema = z.object({
  id: identity,
  version,
  enginesPstdio: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  withdrawn: z.boolean(),
});
export type RegistryRelease = z.infer<typeof releaseSchema>;
const sourceSchema = z.object({ registry: z.string().url(), id: identity, version });
export type RegistrySource = z.infer<typeof sourceSchema>;
export const registrySourceRef = (source: RegistrySource) => `psx:${JSON.stringify(sourceSchema.parse(source))}`;
export const parseRegistrySourceRef = (ref: string | null | undefined) => {
  if (!ref?.startsWith("psx:")) return null;
  try {
    return sourceSchema.parse(JSON.parse(ref.slice(4)));
  } catch {
    return null;
  }
};
export const chooseCompatibleRelease = (releases: RegistryRelease[], hostApi: string) =>
  releases
    .filter((release) => !release.withdrawn && supportsExtensionApiVersion(release.enginesPstdio, hostApi))
    .sort((a, b) => Bun.semver.order(b.version, a.version))[0] ?? null;

export const createRegistryClient = (registry: string) => {
  const base = registry.replace(/\/$/, "");
  const url = new URL(base);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  ) {
    throw new Error("PSX requires HTTPS (loopback HTTP is allowed for isolated tests)");
  }
  const request = async (path: string, signal?: AbortSignal) => {
    let response: Response;
    const deadline = AbortSignal.timeout(10_000);
    try {
      response = await fetch(`${base}${path}`, { signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
    } catch (error) {
      throw new ExtensionRegistryError("Extension registry is unreachable. Try again when the connection returns.", {
        cause: error,
      });
    }
    if (!response.ok) throw new ExtensionRegistryError(`Extension registry request failed (${response.status})`);
    return response;
  };
  const idPath = (id: string) => identity.parse(id).replace(".", "/");
  const versions = async (id: string, signal?: AbortSignal) => {
    const body = z
      .object({ versions: z.array(releaseSchema) })
      .parse(await (await request(`/api/${idPath(id)}/versions`, signal)).json());
    if (body.versions.some((release) => release.id !== id))
      throw new Error("Registry returned a different extension identity");
    return body.versions;
  };
  const latest = async (id: string, hostApi: string, signal?: AbortSignal) => {
    const releases = await versions(id, signal);
    const release = chooseCompatibleRelease(releases, hostApi);
    if (!release) throw new ExtensionRegistryError(`No released version of ${id} supports extension API ${hostApi}.`);
    return release;
  };
  return {
    versions,
    latest,
    prepare: async (release: RegistryRelease, target: string, signal?: AbortSignal) => {
      const response = await request(`/api/${idPath(release.id)}/${version.parse(release.version)}/file`, signal);
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (!response.body) throw new ExtensionRegistryError("Extension package download is empty");
      for await (const chunk of response.body) {
        length += chunk.byteLength;
        if (length > MAX_EXTENSION_PACKAGE_BYTES) throw new ExtensionRegistryError("Extension package is too large");
        chunks.push(chunk);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      try {
        await unpackExtension(bytes, target, release);
      } catch (error) {
        throw new ExtensionRegistryError(error instanceof Error ? error.message : "Invalid extension package", {
          cause: error,
        });
      }
      return { path: target, ref: registrySourceRef({ registry: base, id: release.id, version: release.version }) };
    },
  };
};
