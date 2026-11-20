export type ToolExampleId = "board" | "image" | "canvas" | "icons";

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
    slug: "canvas-editor",
    name: "Canvas editor",
    description: "A canvas of your components: select frames, switch themes, and pan around.",
  },
  {
    id: "icons",
    slug: "icon-set-editor",
    name: "Icon set editor",
    description: "Browse an icon set, preview glyphs at every size, and export them as SVG.",
  },
];
