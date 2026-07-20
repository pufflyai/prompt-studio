export const documentRendererSource = `import type { WorkbenchModuleContribution } from "pstdio-workbench/core";

let notes = [
  "# Document renderer",
  "",
  "Markdown documents open in the shared file renderer.",
  "If you provide a save handler, edits autosave through the renderer.",
].join("\\n");

export const createDocumentRendererModule = (): WorkbenchModuleContribution => ({
  id: "docs.document-renderer",
  activate(ctx) {
    ctx.renderers.registerFileRenderer({
      id: "docs.notes",
      title: "notes.md",
      load: () => ({ fileName: "notes.md", content: notes }),
      save: (_resource, content) => {
        notes = content;
      },
    });

    ctx.layout.registerWidget({
      id: "docs.notes",
      title: "notes.md",
      region: "main",
      rendererId: "docs.notes",
      singleton: true,
    });

    ctx.layout.openWidget("docs.notes");
  },
});`;
