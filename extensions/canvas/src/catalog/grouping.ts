import type { CanvasDefinition, CanvasItem } from "../canvases/definitions";

export const storyTopic = (title: string) =>
  title.replace(/Auto Build (?:Status|form)$/i, "Auto Build").replace(/FolderPickerDialog$/i, "Create folder");
export const storyCanvasId = (suite: string, title: string) =>
  `stories-${suite}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
export const placeGroup = (canvas: CanvasDefinition) => {
  const width = Math.max(...canvas.items.map((item) => item.width)) + 80;
  return {
    ...canvas,
    layout: "grid" as const,
    items: canvas.items.map((item, index) => ({
      ...item,
      position: { x: (index % 4) * width, y: Math.floor(index / 4) * 1100 },
    })),
  };
};
export const addGroupItem = (canvas: CanvasDefinition, item: CanvasItem) => (canvas.items as CanvasItem[]).push(item);
