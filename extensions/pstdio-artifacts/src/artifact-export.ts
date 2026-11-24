import { isAbsolute } from "node:path";
import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { nativeScrollbarDefaults } from "@pstdio/ui/scrollbars";
import { serviceFor } from "./artifact-context";
import { artifactPreviewPolicy, previewFragmentDocument } from "./components/html-preview-document";
import { previewThemeDocument } from "./components/html-preview-theme";

export interface ArtifactExportTheme {
  mode: "light" | "dark";
  variables: Record<string, string>;
}

const defaults = {
  ...nativeScrollbarDefaults,
  "--artifact-bg": "Canvas",
  "--artifact-surface": "color-mix(in srgb, CanvasText 5%, Canvas)",
  "--artifact-fg": "CanvasText",
  "--artifact-muted": "GrayText",
  "--artifact-border": "color-mix(in srgb, CanvasText 20%, Canvas)",
  "--artifact-accent": "LinkText",
  "--artifact-font": "system-ui, sans-serif",
};

export const artifactExportFilename = (title: string) => {
  const name = title
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, "-")
    .replace(/\s+/g, " ")
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 180)
    .trim();
  return `${name || "artifact"}.html`;
};

const attribute = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const buildArtifactExport = async (html: string, theme?: ArtifactExportTheme, title = "Artifact") => {
  const mode = theme?.mode === "dark" ? "dark" : "light";
  const variables = Object.fromEntries(
    Object.entries(defaults).map(([name, fallback]) => {
      const captured = theme?.variables?.[name];
      return [name, typeof captured === "string" && captured.trim() ? captured : fallback];
    }),
  );
  // Preview always uses standards mode, even when the saved source is a fragment.
  const source = await new HTMLRewriter()
    .onDocument({
      doctype(doctype) {
        doctype.remove();
      },
    })
    .transform(new Response(html))
    .text();
  const content = `<!doctype html><meta charset="utf-8">${previewThemeDocument}${previewFragmentDocument}${source}`;
  const message = JSON.stringify({ type: "pstdio.preview-theme", mode: theme ? mode : undefined, variables, title });
  const load = `const theme=${message};theme.mode??=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';this.style.colorScheme=theme.mode;this.contentWindow.postMessage(theme,'*');`;
  // Keep the preview's opaque frame and embedding color scheme. Root CSS alone cannot
  // preserve author media queries when the chosen app theme differs from the system.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${attribute(title)}</title>
<meta http-equiv="Content-Security-Policy" content="${artifactPreviewPolicy}">
<meta name="referrer" content="no-referrer">
<style>html,body{height:100%;margin:0}iframe{display:block;width:100%;height:100%;border:0}</style></head>
<body><iframe title="${attribute(title)}" style="color-scheme:${theme ? mode : "light dark"}" sandbox="allow-scripts" referrerpolicy="no-referrer" onload="${attribute(load)}" srcdoc="${attribute(content)}"></iframe></body></html>`;
};

export const exportArtifact = defineCommand({
  id: "export",
  title: l10n("commands.export", "Export artifact"),
  cli: true,
  params: {
    url: params.text({ required: true }),
    revisionId: params.text(),
    file_path: params.text({ label: l10n("params.exportFile", "Workspace HTML destination") }),
    theme: params.json<ArtifactExportTheme>(),
  },
  async run(ctx, input) {
    if (input.file_path && (isAbsolute(input.file_path) || input.file_path.split(/[\\/]/).includes("..")))
      throw new Error("Use a workspace-relative HTML destination.");
    const content = await serviceFor(ctx).read(input.url, input.revisionId);
    const html = await buildArtifactExport(content.html, input.theme, content.title);
    const fileName = artifactExportFilename(content.title);
    if (input.file_path) {
      const files = ctx.workspaceId ? ctx.workspaceFiles : ctx.projectFiles;
      if (!files) throw new Error("Select a workspace with file access before exporting HTML.");
      await files.writeText(input.file_path, html);
      return { fileName, path: input.file_path, revisionId: content.revisionId };
    }
    return { fileName, html, revisionId: content.revisionId };
  },
});
