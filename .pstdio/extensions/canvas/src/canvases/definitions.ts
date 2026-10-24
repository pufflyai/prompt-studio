import type { Point } from "../controller/geometry";
import type { previews } from "./previews";
export interface CanvasItem {
  id: string;
  name: string;
  component: keyof typeof previews;
  position: Point;
  width: number;
  height: number;
}
export interface CanvasDefinition {
  id: string;
  name: string;
  items: readonly CanvasItem[];
}
// This registry owns membership, names and dimensions. Saved layouts only own positions.
export const canvases: readonly CanvasDefinition[] = [
  {
    id: "playground",
    name: "Design playground",
    items: [
      {
        id: "project-form",
        name: "Project form · default",
        component: "project-form",
        position: { x: 0, y: 0 },
        width: 360,
        height: 320,
      },
      {
        id: "controls",
        name: "Shared controls · interactive",
        component: "controls",
        position: { x: 440, y: 0 },
        width: 360,
        height: 400,
      },
    ],
  },
  {
    id: "foundations",
    name: "Foundations",
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
export const findCanvas = (id: string) => {
  const canvas = canvases.find((entry) => entry.id === id);
  if (!canvas) throw new Error(`Canvas "${id}" does not exist`);
  return canvas;
};
