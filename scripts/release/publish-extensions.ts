import { join, resolve } from "node:path";
import { createRegistryClient, packExtension, releaseBundleHost } from "pstdio-extensions/distribution";
import { buildReleaseRuntimeArtifact } from "../build/release-runtime-artifact";
import { releasedApiBaselines } from "../verify/extension-api-baselines";
import { publishedExtensionDirs, verifyPublishedExtension } from "../verify/verify-published-extensions";

export const publishExtensions = async (root: string, registry: string, token: string) => {
  const client = createRegistryClient(registry);
  const releases = await releasedApiBaselines(root);
  for (const dir of await publishedExtensionDirs(root)) {
    const manifest = await Bun.file(join(root, dir, "package.json")).json();
    const id = `${manifest.publisher}.${manifest.name}`;
    const versions = await client.versions(id);
    const existing = versions.find((release) => release.version === manifest.version);
    const needsRuntime =
      id === "pstdio.planner" &&
      !existing?.withdrawn &&
      !existing?.bundles?.some((bundle) => bundle.host === releaseBundleHost());
    if (existing && !needsRuntime) {
      console.log(`${id}@${manifest.version} is already published.`);
      continue;
    }
    await verifyPublishedExtension(root, dir, releases);
    const packed = await packExtension(join(root, dir));
    if (existing && existing.sha256 !== packed.sha256)
      throw new Error(`The checked-out source no longer matches published ${id}@${manifest.version}.`);
    const runtime = needsRuntime
      ? await buildReleaseRuntimeArtifact(root, { ...packed.manifest, bytes: packed.bytes, sha256: packed.sha256 })
      : undefined;
    if (!existing) {
      const response = await fetch(`${registry.replace(/\/$/, "")}/api/-/publish`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/gzip" },
        body: packed.bytes,
      });
      if (!response.ok) throw new Error(`Publishing ${id}@${manifest.version} failed (${response.status})`);
    }
    if (runtime) {
      const [publisher, name] = id.split(".");
      const endpoint = `${registry.replace(/\/$/, "")}/api/${publisher}/${name}/${manifest.version}/bundles`;
      const bundleResponse = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/gzip" },
        body: runtime.bytes,
      });
      if (!bundleResponse.ok)
        throw new Error(`Publishing runtime for ${id}@${manifest.version} failed (${bundleResponse.status})`);
    }
    console.log(`Published ${packed.filename} (${packed.sha256})`);
  }
};

if (import.meta.main) {
  const registry = process.env.PSTDIO_EXTENSION_REGISTRY;
  const token = process.env.PSX_PUBLISH_TOKEN;
  if (!registry || !token) throw new Error("PSTDIO_EXTENSION_REGISTRY and PSX_PUBLISH_TOKEN are required");
  // Verification runs extension installs and tests; they must not see the publish token.
  delete process.env.PSX_PUBLISH_TOKEN;
  await publishExtensions(resolve(import.meta.dir, "../.."), registry, token);
}
