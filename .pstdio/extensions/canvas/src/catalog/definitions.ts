import type { CanvasDefinition, CanvasItem } from "../canvases/definitions";
import designs from "./generated/designs.json";
import catalog from "./generated/stories.json";

export interface StoryPreview {
  kind: "story";
  id: string;
  suite: string;
  source: string;
  exportName: string;
  component?: string;
  componentImport?: string;
  viewportHeight: number;
}
export interface DocumentPreview {
  kind: "document";
  id: string;
  suite: string;
  source: string;
  content: string;
}
export interface DesignPreview {
  kind: "design";
  file: string;
  rootId: string;
  source: string;
}
export type CatalogPreview = StoryPreview | DocumentPreview | DesignPreview;
const groups = new Map<string, CanvasDefinition>();
for (const story of catalog.stories) {
  const groupId = `stories-${story.suite}-${story.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  // Each application scenario owns its fixture stores. Mounting all variants together lets source-level
  // stores and seeded project IDs overwrite one another. Keep the original group link for its first entry.
  const id = groups.has(groupId) ? `${groupId}-${story.id}` : groupId;
  const canvas: CanvasDefinition = { id, name: `${story.title} · ${story.name}`, group: story.suite, items: [] };
  groups.set(id, canvas);
  (canvas.items as CanvasItem[]).push({
    id: story.id,
    name: `${story.title} · ${story.name}`,
    position: { x: 0, y: 0 },
    width: 1200,
    height: 240,
    preview: {
      kind: "story",
      id: story.id,
      suite: story.suite,
      source: story.source,
      exportName: story.exportName,
      component: story.component,
      componentImport: story.componentImport,
      viewportHeight: 960,
    },
  });
}
for (const document of catalog.documents) {
  groups.set(document.id, {
    id: document.id,
    name: document.name,
    group: "Documentation",
    items: [
      {
        id: document.id,
        name: document.name,
        width: 1040,
        height: 1400,
        position: { x: 0, y: 0 },
        preview: {
          kind: "document",
          id: document.id,
          suite: document.suite,
          source: document.source,
          content: document.content,
        },
      },
    ],
  });
}
export const catalogCanvases: CanvasDefinition[] = [
  ...designs.flatMap((file) =>
    file.roots.map((root) => ({
      id: `design-${file.id}-${root.id}`,
      name: root.name,
      group: file.name,
      keywords: root.keywords,
      items: [
        {
          id: root.id,
          name: root.name,
          width: root.width,
          height: root.height,
          position: { x: 0, y: 0 },
          preview: { kind: "design" as const, file: file.id, rootId: root.id, source: file.source },
        },
      ],
    })),
  ),
  ...groups.values(),
];
