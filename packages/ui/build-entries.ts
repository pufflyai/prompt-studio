import { readFileSync } from "node:fs";
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

const packageJson = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8"));
const externalPackages = [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.peerDependencies)];

// Consumers install ui's dependencies themselves, and the prebuilt Monaco files stay separate so
// apps copy them instead of bundling Monaco again.
export const isExternal = (id: string) =>
  id.startsWith("@pstdio/ui/monaco/") || externalPackages.some((name) => id === name || id.startsWith(`${name}/`));
