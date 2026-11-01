import { type CatalogPreview, catalogCanvases, type StoryPreview } from "../catalog/definitions";
import type { Point } from "../controller/geometry";
import type { previews } from "./previews";
export interface CanvasVariant {
  id: string;
  name: string;
  preview: StoryPreview;
}
export interface CanvasItem {
  id: string;
  name: string;
  component?: keyof typeof previews;
  preview?: CatalogPreview;
  variants?: readonly CanvasVariant[];
  position: Point;
  width: number;
  height: number;
}
export interface CanvasDefinition {
  id: string;
  name: string;
  group?: string;
  path?: readonly string[];
  keywords?: string;
  aliases?: readonly string[];
  layout?: "grid";
  items: readonly CanvasItem[];
}
// This registry owns membership, names and dimensions. Saved layouts only own positions.
export const nativeCanvases: readonly CanvasDefinition[] = [
  {
    id: "canvas-lab-merger",
    name: "Lab merger · proposal",
    group: "Extensions",
    path: ["UI Canvas", "Proposals"],
    keywords: "PS-1006 motion shader parameters playback save versions",
    items: [
      {
        id: "shader-parameters",
        name: "Shader · frame parameters and save",
        component: "proposal-shader-parameters",
        position: { x: 0, y: 0 },
        width: 640,
        height: 600,
      },
      {
        id: "motion-parameters",
        name: "Motion · frame parameters and playback",
        component: "proposal-motion-parameters",
        position: { x: 720, y: 0 },
        width: 640,
        height: 600,
      },
    ],
  },
  {
    id: "foundations",
    name: "Foundations",
    group: "Design System",
    items: [
      {
        id: "colors",
        name: "Colors · semantic tokens",
        component: "foundation-colors",
        position: { x: 0, y: 0 },
        width: 640,
        height: 560,
      },
      {
        id: "typography",
        name: "Typography · type scale",
        component: "foundation-typography",
        position: { x: 720, y: 0 },
        width: 760,
        height: 900,
      },
      {
        id: "spacing",
        name: "Spacing & radius · token scales",
        component: "foundation-spacing",
        position: { x: 1560, y: 0 },
        width: 600,
        height: 860,
      },
    ],
  },
  {
    id: "shared-components",
    name: "Shared components",
    group: "Design System",
    items: [
      {
        id: "buttons",
        name: "Buttons · variants and states",
        component: "button-states",
        position: { x: 0, y: 0 },
        width: 560,
        height: 620,
      },
      {
        id: "fields",
        name: "Inputs · field states",
        component: "field-states",
        position: { x: 640, y: 0 },
        width: 400,
        height: 600,
      },
      {
        id: "selection",
        name: "Selection controls · interactive",
        component: "selection-states",
        position: { x: 1120, y: 0 },
        width: 420,
        height: 600,
      },
      {
        id: "feedback",
        name: "Feedback · alert states",
        component: "feedback-states",
        position: { x: 0, y: 720 },
        width: 640,
        height: 600,
      },
      {
        id: "badges",
        name: "Badges & identity · status states",
        component: "badge-states",
        position: { x: 720, y: 720 },
        width: 520,
        height: 440,
      },
      {
        id: "surfaces",
        name: "Layout & navigation · shared surfaces",
        component: "surface-states",
        position: { x: 1320, y: 720 },
        width: 560,
        height: 520,
      },
      {
        id: "keyboard",
        name: "Keyboard · shortcut styles",
        component: "keyboard-states",
        position: { x: 0, y: 1400 },
        width: 480,
        height: 280,
      },
      {
        id: "empty",
        name: "Empty state · new design",
        component: "empty-states",
        position: { x: 560, y: 1400 },
        width: 480,
        height: 280,
      },
      {
        id: "overlays",
        name: "Overlays · native portals",
        component: "overlay-states",
        position: { x: 1120, y: 1400 },
        width: 480,
        height: 320,
      },
    ],
  },
];
export const canvases: readonly CanvasDefinition[] = [...nativeCanvases, ...catalogCanvases];
export const findCanvas = (id: string) => {
  const canvas = canvases.find((entry) => entry.id === id || entry.aliases?.includes(id));
  if (!canvas) throw new Error(`Canvas "${id}" does not exist`);
  return canvas;
};
