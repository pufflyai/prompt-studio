import type { CanvasDefinition } from "./definitions";

// Interaction and intrinsic-height fixtures stay outside the resource registry.
export const interactionFixture: CanvasDefinition = {
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
};
export const documentationFixture: CanvasDefinition = {
  id: "documentation-contract",
  name: "Documentation panels",
  items: [
    {
      id: "long-documentation",
      name: "Long documentation · intrinsic height",
      component: "long-documentation",
      position: { x: 0, y: 0 },
      width: 640,
      height: 240,
    },
  ],
};
