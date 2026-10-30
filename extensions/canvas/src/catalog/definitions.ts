import type { CanvasDefinition, CanvasVariant } from "../canvases/definitions";
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
export type CatalogPreview = StoryPreview;
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
      ...storyLocation(story.suite, topic, story.source),
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
export const catalogCanvases: CanvasDefinition[] = [...groups.values()].map(placeGroup);
