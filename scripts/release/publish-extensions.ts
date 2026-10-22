import { join, resolve } from "node:path";
import { createRegistryClient, packExtension } from "pstdio-extensions/distribution";
import { publishedExtensionDirs, verifyPublishedExtension } from "../verify/verify-published-extensions";

export const publishExtensions = async (root: string, registry: string, token: string) => {
  const client = createRegistryClient(registry);
  for (const dir of await publishedExtensionDirs(root)) {
    const manifest = await Bun.file(join(root, dir, "package.json")).json();
    const id = `${manifest.publisher}.${manifest.name}`;
    const versions = await client.versions(id);
    if (versions.some((release) => release.version === manifest.version)) {
      console.log(`${id}@${manifest.version} is already published.`);
      continue;
    }
    await verifyPublishedExtension(root, dir);
    const packed = await packExtension(join(root, dir));
    const response = await fetch(`${registry.replace(/\/$/, "")}/api/-/publish`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/gzip" },
      body: packed.bytes,
    });
    if (!response.ok) throw new Error(`Publishing ${id}@${manifest.version} failed (${response.status})`);
    console.log(`Published ${packed.filename} (${packed.sha256})`);
  }
};

if (import.meta.main) {
  const registry = process.env.PSTDIO_EXTENSION_REGISTRY;
  const token = process.env.PSX_PUBLISH_TOKEN;
  if (!registry || !token) throw new Error("PSTDIO_EXTENSION_REGISTRY and PSX_PUBLISH_TOKEN are required");
  await publishExtensions(resolve(import.meta.dir, "../.."), registry, token);
}
