import { type CanvasBuildManifest, MANIFEST_FORMAT } from "@pstdio/canvas";
import {
  type ArtifactMount,
  artifactChanged,
  defineArtifactMount,
  type ExtensionContextBase,
  l10n,
} from "@pstdio/sdk/extensions";

// `pstdio-canvas watch` writes here by default. The host watches the folder and reports every new
// build, so UI Canvas only reads: it never builds or runs project code itself.
export const buildMount = defineArtifactMount({
  id: "build",
  path: "build",
  label: l10n("mounts.build", "Canvas builds"),
  watch: true,
});
export const buildChanged = artifactChanged(buildMount);

export interface BuildFiles extends Pick<ArtifactMount, "exists" | "readText"> {
  projectId: string;
}

const buildPath = (path: string) => {
  if (path.split(/[/\\]/).includes("..")) throw new Error(`Canvas build path escapes the build folder: ${path}`);
  return path;
};

// The declared mount protects both lexical paths and resolved symlink targets.
export const buildFiles = (
  ctx: Pick<ExtensionContextBase, "projectFiles" | "projectId" | "artifacts">,
): BuildFiles | undefined => {
  if (!ctx.projectFiles) return undefined;
  const files = ctx.artifacts.mount("build");
  return {
    projectId: ctx.projectId,
    exists: (path) => files.exists(buildPath(path)),
    readText: (path) => files.readText(buildPath(path)),
  };
};

// The last parsed manifest. A large project's module graph is megabytes, and every frame asks for it.
let parsed: { stamp: string; manifest: CanvasBuildManifest } | undefined;

const readManifest = async (files: BuildFiles, fresh: boolean) => {
  const source = await files.readText("manifest.json");
  const stamp = `${files.projectId}\n${new Bun.CryptoHasher("sha256").update(source).digest("hex")}`;
  if (!fresh && parsed?.stamp === stamp) return parsed.manifest;
  const manifest = JSON.parse(source);
  if (manifest?.format === MANIFEST_FORMAT) parsed = { stamp, manifest };
  return manifest;
};

const hasManifest = (files: BuildFiles) => files.exists("manifest.json").catch(() => undefined);

// A project without a readable local folder has nothing to show; that is a state, not an error.
export const readBuild = async (files: BuildFiles | undefined, options: { fresh?: boolean } = {}) => {
  const exists = files && (await hasManifest(files));
  if (!files || exists === undefined) return { status: "unavailable" as const };
  if (!exists) return { status: "missing" as const };
  const manifest = await readManifest(files, options.fresh ?? false);
  if (manifest?.format !== MANIFEST_FORMAT) return { status: "unsupported" as const, format: manifest?.format };
  return { status: "ready" as const, manifest: manifest as CanvasBuildManifest };
};
