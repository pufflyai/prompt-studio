import type { CanvasDefinition, CanvasVariant } from "../canvases/definitions";
import designs from "./generated/designs.json";
import catalog from "./generated/stories.json";
import { addGroupItem, placeGroup, storyCanvasId, storyTopic } from "./grouping";
import { storyLocation } from "./navigation-groups";

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
  const topic = storyTopic(story.title);
  const key = `${story.suite}:${topic}`;
  const oldId = storyCanvasId(story.suite, story.title);
  let canvas = groups.get(key);
  if (!canvas) {
    canvas = {
      id: oldId,
      name: topic.split("/").at(-1)!,
      ...storyLocation(story.suite, topic),
      items: [],
      aliases: [],
    };
    groups.set(key, canvas);
  }
  (canvas.aliases as string[]).push(oldId, `${oldId}-${story.id}`);
  const preview: StoryPreview = {
    kind: "story",
    id: story.id,
    suite: story.suite,
    source: story.source,
    exportName: story.exportName,
    component: story.component,
    componentImport: story.componentImport,
    viewportHeight: 960,
  };
  let item = canvas.items.find((item) => item.preview?.source === story.source);
  if (!item) {
    item = {
      id: story.id,
      name: story.title.split("/").at(-1)!,
      position: { x: 0, y: 0 },
      width: 1200,
      height: 240,
      preview,
      variants: [],
    };
    addGroupItem(canvas, item);
  }
  (item.variants as CanvasVariant[]).push({ id: story.id, name: story.name, preview });
}
for (const document of catalog.documents) {
  let section = document.suite === "ui" ? "Component guide" : "Workbench reference";
  if (document.source.includes("/onboarding/")) section = "Workbench onboarding";
  let canvas = groups.get(section);
  if (!canvas) {
    canvas = {
      id: document.id,
      name: section,
      group: document.suite === "ui" ? "Design System" : "Workbench Core",
      path: ["Documentation"],
      items: [],
      aliases: [],
    };
    groups.set(section, canvas);
  }
  (canvas.aliases as string[]).push(document.id);
  addGroupItem(canvas, {
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
  });
}
for (const file of designs) {
  const topic = file.id === "autobuilder" ? "dashboard:Extensions/Planner/Auto Build" : `reference:${file.id}`;
  let canvas = groups.get(topic);
  if (!canvas) {
    canvas = {
      id: `design-${file.id}-${file.roots[0].id}`,
      name: file.name,
      group:
        ({ "design-system": "Design System", website: "Dashboard" } as Record<string, string>)[file.id] ?? "Extensions",
      path: ["Design references"],
      items: [],
      aliases: [],
    };
    groups.set(topic, canvas);
  }
  for (const root of file.roots) {
    (canvas.aliases as string[]).push(`design-${file.id}-${root.id}`);
    addGroupItem(canvas, {
      id: root.id,
      name: root.name,
      width: root.width,
      height: root.height,
      position: { x: 0, y: 0 },
      preview: { kind: "design" as const, file: file.id, rootId: root.id, source: file.source },
    });
  }
}
export const catalogCanvases: CanvasDefinition[] = [...groups.values()].map(placeGroup);
