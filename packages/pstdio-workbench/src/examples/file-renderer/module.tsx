import { Button, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchModuleContribution } from "../../core";

const PANEL_PLACEHOLDER_ID = "file-renderer.story.placeholder";
const PANEL_PLACEHOLDER_RENDERER_ID = "file-renderer.story.placeholder.renderer";
const MARKDOWN_PANEL_ID = "file-renderer.story.markdown.widget";
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
const imageDataUrl = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" rx="12" fill="#5b8def"/><text x="120" y="90" font-family="sans-serif" font-size="20" fill="white" text-anchor="middle">image</text></svg>')}`;
const renderers = [
  {
    rendererId: "file-renderer.story.markdown",
    panelId: MARKDOWN_PANEL_ID,
    title: "notes.md",
    load: () => ({ fileName: "notes.md", content: markdownContent }),
    save: (_resource: unknown, content: string) => {
      markdownContent = content;
    },
  },
  {
    rendererId: "file-renderer.story.code",
    panelId: "file-renderer.story.code.widget",
    title: "example.ts",
    load: () => ({ fileName: "example.ts", content: codeContent }),
    save: (_resource: unknown, content: string) => {
      codeContent = content;
    },
  },
  {
    rendererId: "file-renderer.story.image",
    panelId: "file-renderer.story.image.widget",
    title: "logo.svg",
    load: () => ({ fileName: "logo.svg", mimeType: "image/svg+xml", dataUrl: imageDataUrl }),
  },
] as const;
// Stands in for an agent or the CLI writing the document while the workbench is
// open: the editor must show the new text without losing an unsaved local edit.
const ExternalWriteControl = (props: { onWrite: () => void }) => {
  const { onWrite } = props;
  return (
    <Stack p="md" gap="sm" align="start">
      <Text textStyle="paragraph/XS/regular" color="fg.muted">
        Replace notes.md from outside the editor.
      </Text>
      <Button size="xs" variant="subtle" onClick={onWrite}>
        Write notes.md externally
      </Button>
    </Stack>
  );
};
export const createFileRendererStoryModule = (): WorkbenchModuleContribution => ({
  id: "file-renderer.story",
  activate(ctx) {
    ctx.views.registerView({
      id: PANEL_PLACEHOLDER_RENDERER_ID,
      title: "Documents",
      body: {
        kind: "react",
        render: () => (
          <ExternalWriteControl
            onWrite={() => {
              markdownContent = `# Written outside the editor\n\nAn agent or the CLI replaced this document at ${new Date().toLocaleTimeString()}.`;
              ctx.views.refreshView(MARKDOWN_PANEL_ID);
            }}
          />
        ),
      },
    });
    ctx.placeholders.registerPlaceholder({
      id: PANEL_PLACEHOLDER_ID,
      viewId: PANEL_PLACEHOLDER_RENDERER_ID,
      region: "main",
    });
    for (const renderer of renderers) {
      ctx.views.registerView({
        id: renderer.panelId,
        title: renderer.title,
        body: {
          kind: "file",
          load: renderer.load,
          save: "save" in renderer ? renderer.save : undefined,
        },
      });
      ctx.shellPlacements.registerPlacement({
        id: renderer.panelId,
        item: {
          kind: "view",
          presence: "open",
          view: {
            kind: "view",
            id: renderer.panelId,
          },
        },
        region: "main",
      });
    }
  },
});
export const createFileRendererErrorStoryModule = (): WorkbenchModuleContribution => ({
  id: "file-renderer.error-story",
  activate(ctx) {
    const panelId = "file-renderer.story.load-error.widget";
    ctx.views.registerView({
      id: panelId,
      title: "unavailable.md",
      body: {
        kind: "file",
        load: async () => {
          throw new Error("The document could not be loaded.");
        },
        save: () => {},
      },
    });
    ctx.shellPlacements.registerPlacement({
      id: panelId,
      item: {
        kind: "view",
        presence: "open",
        view: {
          kind: "view",
          id: panelId,
        },
      },
      region: "main",
    });
  },
});
