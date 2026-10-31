import { type CanvasBuildManifest, MANIFEST_FORMAT } from "@pstdio/canvas";
import { type ArtifactMount, defineArtifactMount, type ExtensionContextBase, l10n } from "@pstdio/sdk/extensions";

// `pstdio-canvas watch` writes here by default. The host reports every new build, so UI Canvas
// only reads: it never builds or runs project code itself.
export const buildMount = defineArtifactMount({
  id: "build",
  path: "build",
  label: l10n("mounts.build", "Canvas builds"),
  watch: true,
});

export const buildFiles = (ctx: Pick<ExtensionContextBase, "artifacts">) => ctx.artifacts.mount(buildMount.id);

export type BuildState =
  | { status: "missing" }
  | { status: "unsupported"; format: unknown }
  | { status: "ready"; manifest: CanvasBuildManifest };

export const readBuild = async (files: ArtifactMount): Promise<BuildState> => {
  if (!(await files.exists("manifest.json"))) return { status: "missing" };
  const manifest = JSON.parse(await files.readText("manifest.json"));
  if (manifest?.format !== MANIFEST_FORMAT) return { status: "unsupported", format: manifest?.format };
  return { status: "ready", manifest };
};
