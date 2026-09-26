import path from "node:path";

export const entries = {
  index: path.resolve(import.meta.dirname, "src/index.ts"),
  "rich-text": path.resolve(import.meta.dirname, "src/components/rich-text/index.ts"),
  theme: path.resolve(import.meta.dirname, "src/theme/index.ts"),
  "chat-ui": path.resolve(import.meta.dirname, "src/components/chat-ui/index.ts"),
  diff: path.resolve(import.meta.dirname, "src/components/diff-viewer/index.ts"),
  "kanban-renderer": path.resolve(import.meta.dirname, "src/components/kanban-renderer/index.ts"),
  "param-editor": path.resolve(import.meta.dirname, "src/components/param-editor/index.ts"),
  "data-table": path.resolve(import.meta.dirname, "src/components/data-table/index.ts"),
  mermaid: path.resolve(import.meta.dirname, "src/components/mermaid-renderer/index.ts"),
  terminal: path.resolve(import.meta.dirname, "src/components/terminal/index.ts"),
};
