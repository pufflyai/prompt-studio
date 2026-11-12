import { readFileSync } from "node:fs";
import path from "node:path";

export const entries = {
  charts: path.resolve(import.meta.dirname, "src/components/charts/index.ts"),
  "keyframe-timeline": path.resolve(import.meta.dirname, "src/components/keyframe-timeline/index.ts"),
  index: path.resolve(import.meta.dirname, "src/index.ts"),
  canvas: path.resolve(import.meta.dirname, "src/components/canvas/index.ts"),
  "dependency-timeline": path.resolve(import.meta.dirname, "src/components/dependency-timeline/index.ts"),
  "rich-text": path.resolve(import.meta.dirname, "src/components/rich-text/index.ts"),
  "lazy-markdown-editor": path.resolve(import.meta.dirname, "src/components/rich-text/lazy-markdown-editor.tsx"),
  theme: path.resolve(import.meta.dirname, "src/theme/index.ts"),
  "chat-ui": path.resolve(import.meta.dirname, "src/components/chat-ui/index.ts"),
  "chat-skeleton": path.resolve(import.meta.dirname, "src/components/chat-ui/components/chat-skeleton.tsx"),
  diff: path.resolve(import.meta.dirname, "src/components/diff-viewer/index.ts"),
  "kanban-renderer": path.resolve(import.meta.dirname, "src/components/kanban-renderer/index.ts"),
  "command-form": path.resolve(import.meta.dirname, "src/components/command-form/index.ts"),
  "param-editor": path.resolve(import.meta.dirname, "src/components/param-editor/index.ts"),
  "data-table": path.resolve(import.meta.dirname, "src/components/data-table/index.ts"),
  "collection-view": path.resolve(import.meta.dirname, "src/components/collection-view/index.ts"),
  mermaid: path.resolve(import.meta.dirname, "src/components/mermaid-renderer/index.ts"),
  terminal: path.resolve(import.meta.dirname, "src/components/terminal/index.ts"),
};

const packageJson = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8"));
// Bundle the repaired scroll controller for published consumers; see ADR 0142.
const externalPackages = [
  ...Object.keys(packageJson.dependencies),
  ...Object.keys(packageJson.peerDependencies),
].filter((name) => name !== "use-stick-to-bottom");

// Other dependencies remain external. The prebuilt Monaco files stay separate so apps copy them
// instead of bundling Monaco again.
export const isExternal = (id: string) =>
  id.startsWith("@pstdio/ui/monaco/") || externalPackages.some((name) => id === name || id.startsWith(`${name}/`));
