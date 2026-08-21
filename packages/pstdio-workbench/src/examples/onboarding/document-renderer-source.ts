export const documentRendererSource = `import type { WorkbenchModuleContribution } from "@pstdio/workbench";

let notes = [
  "# Document renderer",
  "",
  "Markdown documents open in the shared file renderer.",
  "If you provide a save handler, edits autosave through the renderer.",
].join("\\n");

export const createDocumentRendererModule = (): WorkbenchModuleContribution => ({
  id: "docs.document-renderer",
  activate(ctx) {
    ctx.renderers.registerRenderer({
      id: "docs.documents",
      render: () => null,
    });
    ctx.renderers.registerFileRenderer({
      id: "docs.notes",
      title: "notes.md",
      load: () => ({ fileName: "notes.md", content: notes }),
      save: (_resource, content) => {
        notes = content;
      },
    });

    ctx.layout.registerPlaceholder({
      id: "docs.documents.placeholder",
      title: "Documents",
      region: "main",
      rendererId: "docs.documents",
    });
    ctx.layout.registerPanel({
      id: "docs.notes",
      title: "notes.md",
      region: "main",
      rendererId: "docs.notes",
      singleton: true,
    });

    ctx.layout.openPanel("docs.notes", { closable: true });
  },
});`;
