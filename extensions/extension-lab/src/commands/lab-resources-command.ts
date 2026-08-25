import { defineCommand } from "@pstdio/sdk/extensions";

interface SlideResource {
  id: string;
  label: string;
  description: string;
  keywords: string[];
}

// Demo data for the command palette resource provider. A real presentation extension
// would derive these from the active deck instead of a static list.
const slides: SlideResource[] = [
  { id: "intro", label: "Introduction", description: "Opening slide", keywords: ["start", "welcome"] },
  {
    id: "architecture",
    label: "Architecture overview",
    description: "How the lab fits together",
    keywords: ["design"],
  },
  { id: "demo", label: "Live demo", description: "Walkthrough of the lab", keywords: ["walkthrough"] },
  { id: "q-and-a", label: "Q&A", description: "Questions and answers", keywords: ["questions"] },
];

const matchesQuery = (slide: SlideResource, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [slide.label, slide.description, ...slide.keywords].join(" ").toLowerCase().includes(needle);
};

export const queryLabResourcesCommand = defineCommand({
  title: "Query lab palette resources",
  description: "Returns demo slide resources for the command palette resource provider.",
  async run(_ctx, commandParams) {
    const params = commandParams as { query?: string; limit?: number };
    const query = params.query ?? "";
    const limit = params.limit ?? slides.length;

    return {
      items: slides
        .filter((slide) => matchesQuery(slide, query))
        .slice(0, limit)
        .map((slide) => ({
          id: slide.id,
          label: slide.label,
          description: slide.description,
          icon: "Presentation",
          keywords: slide.keywords,
          target: {
            kind: "command",
            command: "extension-lab.command-palette-resources.open",
            params: { label: slide.label },
          },
        })),
    };
  },
});

export const openLabResourceCommand = defineCommand({
  title: "Open lab palette resource",
  description: "Invoked when a lab slide is selected from the command palette.",
  async run(ctx, commandParams) {
    const label = (commandParams as { label?: string }).label ?? "slide";
    await ctx.notify.toast({ type: "info", title: "Opened slide", message: label });
    return { opened: true, label };
  },
});
