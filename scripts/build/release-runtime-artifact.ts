import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extensionReleaseBundleSchema, type PackageIdentity } from "pstdio-extensions/distribution";

export const buildReleaseRuntimeArtifact = async (root: string, source: PackageIdentity & { bytes: Uint8Array }) => {
  const work = await mkdtemp(join(tmpdir(), "pstdio-release-runtime-"));
  const archive = join(work, "source.tgz");
  try {
    await Bun.write(archive, source.bytes);
    const child = Bun.spawn([
      process.execPath,
      join(root, "packages/pstdio-api/scripts/prepare-release-bundle.ts"),
      archive,
      work,
    ], {
      cwd: join(root, "packages/pstdio-api"),
      env: { ...process.env, PSTDIO_HOME: join(work, "home") },
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await child.exited;
    if (exitCode !== 0) throw new Error(`Runtime preparation failed for ${source.id}@${source.version} (${exitCode}).`);
    const descriptor = extensionReleaseBundleSchema.parse(await Bun.file(join(work, "runtime.json")).json());
    if (descriptor.sourceSha256 !== source.sha256) throw new Error("Runtime preparation used a different source.");
    return { descriptor, bytes: await Bun.file(join(work, "runtime.tgz")).bytes() };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
};
