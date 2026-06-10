import type { WorkbenchModuleContribution } from "../../core";

// In-memory documents the example file renderers read and write. The markdown and
// code renderers are editable (they declare a `save`); the image is read-only.
let markdownContent = [
  "# File renderer",
  "",
  "This document is rendered by the **MarkdownEditor**. Edit it — changes autosave",
  "through the renderer's `save` command.",
  "",
  "- markdown for `.md` / `.txt`",
  "- Monaco for code files",
  "- read-only `<img>` for images",
].join("\n");

let codeContent = [
  "export const greet = (name: string) => {",
  "  // Edited in the Monaco code editor.",
  `  return \`Hello, \${name}\`;`,
  "};",
  "",
].join("\n");

const imageDataUrl = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" rx="12" fill="#5b8def"/><text x="120" y="90" font-family="sans-serif" font-size="20" fill="white" text-anchor="middle">image</text></svg>',
)}`;

const renderers = [
  {
    rendererId: "file-renderer.story.markdown",
    widgetId: "file-renderer.story.markdown.widget",
    title: "notes.md",
    load: () => ({ fileName: "notes.md", content: markdownContent }),
    save: (_resource: unknown, content: string) => {
      markdownContent = content;
    },
  },
  {
    rendererId: "file-renderer.story.code",
    widgetId: "file-renderer.story.code.widget",
    title: "example.ts",
    load: () => ({ fileName: "example.ts", content: codeContent }),
    save: (_resource: unknown, content: string) => {
      codeContent = content;
    },
  },
  {
    rendererId: "file-renderer.story.image",
    widgetId: "file-renderer.story.image.widget",
    title: "logo.svg",
    load: () => ({ fileName: "logo.svg", mimeType: "image/svg+xml", dataUrl: imageDataUrl }),
  },
] as const;

export const createFileRendererStoryModule = (): WorkbenchModuleContribution => ({
  id: "file-renderer.story",
  activate(ctx) {
    for (const renderer of renderers) {
      ctx.renderers.registerFileRenderer({
        id: renderer.rendererId,
        title: renderer.title,
        load: renderer.load,
        save: "save" in renderer ? renderer.save : undefined,
      });
      ctx.layout.registerWidget({
        id: renderer.widgetId,
        title: renderer.title,
        area: "main",
        rendererId: renderer.rendererId,
        singleton: true,
      });
      ctx.layout.openWidget(renderer.widgetId, { title: renderer.title });
    }
  },
});
