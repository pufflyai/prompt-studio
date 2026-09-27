import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { catalog, defaultSettings, type ReviewSettings, settingsChanged } from "./catalog";

const itemParam = () =>
  params.select({ required: true, options: catalog.map((item) => ({ value: item.id, label: item.label })) });

const read = defineCommand({
  id: "review.read",
  title: l10n("review.read", "Read review settings"),
  params: { id: itemParam() },
  async run(ctx, { id }) {
    return (await ctx.storage.collection<ReviewSettings>("reviews").get(id)) ?? defaultSettings(id);
  },
});

const update = defineCommand({
  id: "review.update",
  title: l10n("review.update", "Update review settings"),
  params: {
    id: itemParam(),
    heading: params.text({ required: true }),
    showDetails: params.boolean({ required: true }),
  },
  async run(ctx, { id, heading, showDetails }) {
    const settings: ReviewSettings = { heading, showDetails };
    await ctx.storage.collection<ReviewSettings>("reviews").put(id, settings);
    await ctx.events.emit(settingsChanged, { id });
    return settings;
  },
});

export const commands = { "review.read": read, "review.update": update };
