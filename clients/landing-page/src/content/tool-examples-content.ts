export type ToolExampleId = "board" | "image" | "canvas" | "scene";

/** The tools the Examples page records, in reel order. Each gets its own page path. */
export const TOOL_EXAMPLES: { id: ToolExampleId; slug: string; name: string; description: string }[] = [
  {
    id: "board",
    slug: "ticket-board",
    name: "Ticket board",
    description: "A ticket board where agents pick up work, report back, and move tickets to review.",
  },
  {
    id: "image",
    slug: "image-editor",
    name: "Image editor",
    description: "A layered image editor: select, move, and fade layers on a canvas.",
  },
  {
    id: "canvas",
    slug: "ui-editor",
    name: "UI editor",
    description: "A UI editor for your components: select frames, switch themes, and pan around.",
  },
  {
    id: "scene",
    slug: "3d-preview",
    name: "3D preview",
    description: "A 3D preview: play an animation on a timeline and pick keyframes.",
  },
];
