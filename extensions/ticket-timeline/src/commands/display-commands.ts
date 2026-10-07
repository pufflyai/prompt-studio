// Read and save ticket visibility and dependency arrow style for the project.
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { type DisplaySettings, displayChanged } from "../contracts";
import { readDisplay } from "../model/display";

const displayKey = "display";

export const readDisplayCommand = defineCommand({
  id: "display.read",
  title: "Read timeline display",
  cli: { description: "Print the timeline's display settings as JSON." },
  async run(ctx) {
    return readDisplay(await ctx.storage.get<DisplaySettings>(displayKey));
  },
});

export const saveDisplayCommand = defineCommand({
  id: "display.save",
  title: "Save timeline display",
  cli: { description: "Replace the timeline's display settings with a complete JSON value." },
  params: {
    display: params.json<DisplaySettings, { label: string; description: string; required: true }>({
      label: "Display",
      description: "Complete display settings.",
      required: true,
    }),
  },
  async run(ctx, { display }) {
    const next = readDisplay(display);
    await ctx.storage.set(displayKey, next);
    await ctx.events.emit(displayChanged, { reason: "display" });
    return next;
  },
});
