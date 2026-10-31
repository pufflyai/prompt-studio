import { type CanvasBuildManifest, DEFAULT_OUT, MANIFEST_FORMAT } from "@pstdio/canvas";
import { type ArtifactMount, defineArtifactMount, type ExtensionContextBase, l10n } from "@pstdio/sdk/extensions";

// `pstdio-canvas watch` writes here by default. The host watches the folder and reports every new
// build, so UI Canvas only reads: it never builds or runs project code itself.
export const buildMount = defineArtifactMount({
  id: "build",
  path: "build",
  label: l10n("mounts.build", "Canvas builds"),
  watch: true,
});

type BuildFiles = Pick<ArtifactMount, "exists" | "readText">;

// Builds are local, regenerated output. Reads go to the project folder directly, because reads
// through the mount copy every file into synced extension storage first.
export const buildFiles = (ctx: Pick<ExtensionContextBase, "projectFiles">): BuildFiles => {
  const files = ctx.projectFiles;
  if (!files) return { exists: async () => false, readText: async (path) => Promise.reject(new Error(path)) };
  return {
    exists: (path) => files.exists(`${DEFAULT_OUT}/${path}`),
    readText: (path) => files.readText(`${DEFAULT_OUT}/${path}`),
  };
};

export type BuildState =
  | { status: "missing" }
  | { status: "unsupported"; format: unknown }
  | { status: "ready"; manifest: CanvasBuildManifest };

export const readBuild = async (files: BuildFiles): Promise<BuildState> => {
  if (!(await files.exists("manifest.json"))) return { status: "missing" };
  const manifest = JSON.parse(await files.readText("manifest.json"));
  if (manifest?.format !== MANIFEST_FORMAT) return { status: "unsupported", format: manifest?.format };
  return { status: "ready", manifest };
};
