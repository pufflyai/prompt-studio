import { and, eq } from "drizzle-orm";
import { inspectExtensionReleaseBundle, MAX_EXTENSION_PACKAGE_BYTES } from "pstdio-extensions/distribution";
import type { PsxDatabase } from "./database";
import { extensionReleaseBundles, type extensionReleases } from "./schema";
import type { PsxOptions } from "./service";

type Release = typeof extensionReleases.$inferSelect;
type BundleRow = typeof extensionReleaseBundles.$inferSelect;
const bundleKey = (bundle: BundleRow) => `${bundle.extensionId}/${bundle.version}/runtime/${bundle.sha256}.tgz`;

export const listRuntimeBundles = (database: PsxDatabase, extensionId: string) =>
  database.select().from(extensionReleaseBundles).where(eq(extensionReleaseBundles.extensionId, extensionId));

const getBundle = async (database: PsxDatabase, release: Release, key: { sha256: string } | { host: string }) => {
  const [bundle] = await database
    .select()
    .from(extensionReleaseBundles)
    .where(
      and(
        eq(extensionReleaseBundles.extensionId, release.extensionId),
        eq(extensionReleaseBundles.version, release.version),
        "sha256" in key ? eq(extensionReleaseBundles.sha256, key.sha256) : eq(extensionReleaseBundles.host, key.host),
      ),
    );
  return bundle;
};

export const downloadRuntimeBundle = async (options: PsxOptions, release: Release, sha256: string) => {
  const bundle = await getBundle(options.database, release, { sha256 });
  if (!bundle) return Response.json({ error: "Runtime bundle not found" }, { status: 404 });
  return new Response(new Uint8Array(await options.objects.get(bundleKey(bundle))), {
    headers: {
      "content-type": "application/gzip",
      "cache-control": "public, max-age=31536000, immutable",
      etag: `"${sha256}"`,
    },
  });
};

export const publishRuntimeBundle = async (options: PsxOptions, release: Release, request: Request) => {
  if (release.withdrawn) return Response.json({ error: "Release is withdrawn" }, { status: 409 });
  if (Number(request.headers.get("content-length")) > MAX_EXTENSION_PACKAGE_BYTES)
    return Response.json({ error: "Runtime bundle is too large" }, { status: 413 });
  let bytes: Uint8Array;
  let descriptor: Awaited<ReturnType<typeof inspectExtensionReleaseBundle>>["descriptor"];
  try {
    bytes = new Uint8Array(await request.arrayBuffer());
    const inspected = await inspectExtensionReleaseBundle(bytes);
    if (
      inspected.manifest.extensionId !== release.extensionId ||
      inspected.manifest.version !== release.version ||
      inspected.descriptor.sourceSha256 !== release.sha256
    )
      throw new Error("Bundle and release differ");
    descriptor = inspected.descriptor;
  } catch {
    return Response.json({ error: "Invalid runtime bundle for this release" }, { status: 400 });
  }
  const { host, sha256, sizeBytes } = descriptor;
  const previous = await getBundle(options.database, release, { host });
  if (previous && previous.sha256 !== sha256)
    return Response.json({ error: "Published runtime bundles cannot change" }, { status: 409 });
  if (!previous) {
    const bundle = { extensionId: release.extensionId, version: release.version, host, sha256, sizeBytes };
    await options.objects.put(bundleKey(bundle), bytes);
    await options.database.insert(extensionReleaseBundles).values(bundle).onConflictDoNothing();
    if ((await getBundle(options.database, release, { host }))?.sha256 !== sha256)
      return Response.json({ error: "Published runtime bundles cannot change" }, { status: 409 });
  }
  return Response.json(descriptor, { status: previous ? 200 : 201 });
};
