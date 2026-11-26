import { access, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { type PreparedExtensionRevision, readPackageManifest } from "pstdio-extensions";
import {
  type ExtensionReleaseBundle,
  packExtensionReleaseBundle,
  releaseBundleEntry,
  releaseBundleViews,
  unpackExtensionReleaseBundle,
} from "pstdio-extensions/distribution";
import {
  preparationHostIdentity,
  preparedCacheRoot,
  retainPreparedRevision,
  revisionDigest,
} from "pstdio-extensions/prepared-cache";
import { copyExtensionSource } from "./copy-extension-source";

const packagePathToken = "__PSTDIO_RELEASE_PACKAGE_PATH__";
const packageUrlToken = "pstdio-release-package:///";
const jsPath = (path: string) => JSON.stringify(path).slice(1, -1);
const packageUrl = (path: string) => pathToFileURL(path).href;

export interface DownloadedReleaseBundle {
  path: string;
  descriptor: ExtensionReleaseBundle;
  sourceSha256: string;
}

const collectViewFiles = async (path: string, name: string, files: Record<string, Uint8Array>) => {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    const key = `${name}/${entry.name}`;
    if (entry.isDirectory()) await collectViewFiles(file, key, files);
    else if (entry.isFile()) files[key] = await readFile(file);
  }
};

export const exportPreparedReleaseBundle = async (revision: PreparedExtensionRevision, sourceSha256: string) => {
  const content = await readFile(revision.entryPath, "utf8");
  const portable = content
    .replaceAll(packageUrl(revision.packagePath), packageUrlToken)
    .replaceAll(jsPath(revision.packagePath), packagePathToken);
  const files: Record<string, Uint8Array> = { [releaseBundleEntry]: new TextEncoder().encode(portable) };
  const views = Object.entries(revision.webviews ?? {}).sort(([left], [right]) => left.localeCompare(right));
  for (const [index, [, view]] of views.entries()) {
    await collectViewFiles(view.distDir, `${releaseBundleViews}/${index}`, files);
  }
  return packExtensionReleaseBundle(
    {
      extensionId: revision.manifest.id,
      version: revision.manifest.version,
      sourceSha256,
      webviews: views.map(([id]) => id),
    },
    files,
  );
};

const warmedRevisionId = (descriptor: ExtensionReleaseBundle) =>
  revisionDigest(`warmed-release:${descriptor.sha256}:${preparationHostIdentity()}`);
const revisionRoot = (id: string) => join(preparedCacheRoot(), "revisions", id);
const warmedMetadata = (root: string) => join(root, "warmed-release.json");
const warmedSource = (root: string) => join(root, "editable-source");

export const readWarmedExtensionRelease = async (
  descriptor: ExtensionReleaseBundle,
  release: { id: string; version: string; sha256: string },
) => {
  const id = warmedRevisionId(descriptor);
  const root = revisionRoot(id);
  try {
    const metadata = (await Bun.file(warmedMetadata(root)).json()) as {
      sourceSha256: string;
      revision: PreparedExtensionRevision;
    };
    const { revision } = metadata;
    if (
      metadata.sourceSha256 !== release.sha256 ||
      revision.id !== id ||
      revision.host !== preparationHostIdentity() ||
      revision.manifest.id !== release.id ||
      revision.manifest.version !== release.version
    )
      return;
    await Promise.all([
      access(join(warmedSource(root), "package.json")),
      access(revision.entryPath),
      ...Object.values(revision.webviews ?? {}).map((view) => access(join(view.distDir, "module.js"))),
    ]);
    return { path: warmedSource(root), preparedRelease: revision };
  } catch {
    return;
  }
};

/** Import verified artifacts into the existing prepared revision cache before activation. */
export const importPreparedReleaseBundle = async (
  bundle: DownloadedReleaseBundle,
  sourcePath: string,
  sourceHash: string,
  warmOnly = false,
): Promise<PreparedExtensionRevision> => {
  const { manifest, diagnostics } = readPackageManifest(sourcePath);
  if (!manifest) throw new Error("Extension manifest could not be read for its runtime bundle.");
  const host = preparationHostIdentity();
  const id = warmOnly
    ? warmedRevisionId(bundle.descriptor)
    : revisionDigest(`release:${bundle.descriptor.sha256}:${host}`);
  const root = revisionRoot(id);
  const packagePath = join(root, "package");
  const entryPath = join(packagePath, ".pstdio-release-runtime.mjs");
  await mkdir(dirname(root), { recursive: true });
  const stage = join(dirname(root), `staging-${crypto.randomUUID()}`);
  try {
    const metadata = await unpackExtensionReleaseBundle(
      await Bun.file(bundle.path).bytes(),
      bundle.descriptor,
      { id: manifest.id, version: manifest.version, sha256: bundle.sourceSha256 },
      stage,
    );
    const modulePath = join(stage, releaseBundleEntry);
    const source = await readFile(modulePath, "utf8");
    const stagedPackage = join(stage, "package");
    await copyExtensionSource(sourcePath, stagedPackage);
    await writeFile(
      join(stagedPackage, ".pstdio-release-runtime.mjs"),
      source.replaceAll(packageUrlToken, packageUrl(packagePath)).replaceAll(packagePathToken, jsPath(packagePath)),
    );
    await rm(modulePath);
    const webviews = Object.fromEntries(
      metadata.webviews.map((view, index) => [
        view,
        {
          id: revisionDigest(`${bundle.descriptor.sha256}:${view}`),
          distDir: join(root, releaseBundleViews, String(index)),
        },
      ]),
    );
    const revision: PreparedExtensionRevision = {
      id,
      host,
      packagePath,
      entryPath,
      sourceHash,
      loadKey: id,
      manifest,
      diagnostics,
      webviews,
      prebuiltRelease: true,
    };
    if (warmOnly) {
      await copyExtensionSource(sourcePath, warmedSource(stage));
      await writeFile(warmedMetadata(stage), JSON.stringify({ sourceSha256: bundle.sourceSha256, revision }));
    }
    try {
      await rename(stage, root);
    } catch (error) {
      if (!(await Bun.file(entryPath).exists())) throw error;
    }
    if (!warmOnly) retainPreparedRevision(revision);
    return revision;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
};
