import { packageSha256, readExtensionPackage, registryVersionSchema } from "pstdio-extensions/distribution";
import { getRelease, objectKey } from "./releases";
import { extensionReleases } from "./schema";
import type { PsxOptions } from "./service";

export const publishPackage = async (options: PsxOptions, request: Request) => {
  let bytes: Uint8Array;
  let manifest: Awaited<ReturnType<typeof readExtensionPackage>>["manifest"];
  try {
    bytes = new Uint8Array(await request.arrayBuffer());
    manifest = (await readExtensionPackage(bytes)).manifest;
  } catch {
    return Response.json({ error: "Invalid extension package" }, { status: 400 });
  }
  if (manifest.publisher !== "pstdio") return Response.json({ error: "Core publishing only" }, { status: 403 });
  if (!registryVersionSchema.safeParse(manifest.version).success) {
    return Response.json({ error: "PSX publishes stable extension versions only" }, { status: 400 });
  }
  const release = {
    extensionId: manifest.id,
    version: manifest.version,
    enginesPstdio: manifest.enginesPstdio,
    sha256: packageSha256(bytes),
  };
  const previous = await getRelease(options.database, manifest.id, manifest.version);
  if (previous && previous.sha256 !== release.sha256) {
    return Response.json({ error: "Published versions cannot change" }, { status: 409 });
  }
  if (!previous) {
    await options.objects.put(objectKey(release), bytes);
    await options.database.insert(extensionReleases).values(release).onConflictDoNothing();
  }
  const saved = await getRelease(options.database, manifest.id, manifest.version);
  if (saved.sha256 !== release.sha256)
    return Response.json({ error: "Published versions cannot change" }, { status: 409 });
  return Response.json(
    { id: saved.extensionId, version: saved.version, sha256: saved.sha256 },
    { status: previous ? 200 : 201 },
  );
};
