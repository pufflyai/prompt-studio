import { type CanvasBuildManifest, DEFAULT_OUT, MANIFEST_FORMAT } from "@pstdio/canvas";
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
  /** Identifies the current manifest, so an unchanged build is parsed once. */
  stamp: () => Promise<string | undefined>;
}

// Builds are local, regenerated output. Reads go to the project folder directly, because reads
// through the mount copy every file into synced extension storage first.
export const buildFiles = (ctx: Pick<ExtensionContextBase, "projectFiles" | "projectId">): BuildFiles | undefined => {
  const files = ctx.projectFiles;
  if (!files) return undefined;
  const manifest = `${DEFAULT_OUT}/manifest.json`;
  return {
    exists: (path) => files.exists(`${DEFAULT_OUT}/${path}`),
    readText: (path) => files.readText(`${DEFAULT_OUT}/${path}`),
    stamp: async () => {
      const [entry] = await files.list(manifest);
      return entry?.updatedAt && `${ctx.projectId}\n${entry.updatedAt}\n${entry.size ?? ""}`;
    },
  };
};

// The last parsed manifest. A large project's module graph is megabytes, and every frame asks for it.
let parsed: { stamp: string; manifest: CanvasBuildManifest } | undefined;

const readManifest = async (files: BuildFiles, fresh: boolean) => {
  const stamp = await files.stamp();
  if (!fresh && stamp && parsed?.stamp === stamp) return parsed.manifest;
  const manifest = JSON.parse(await files.readText("manifest.json"));
  if (stamp && manifest?.format === MANIFEST_FORMAT) parsed = { stamp, manifest };
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
