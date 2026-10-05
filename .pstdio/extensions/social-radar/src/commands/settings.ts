import { defineCommand, params } from "@pstdio/sdk/extensions";
import { siteSchema } from "../schemas";
import { readSettings, settingsSchema, writeSettings } from "../settings";
import { changed } from "../store";

const save = async (ctx: Parameters<typeof changed>[0], input: unknown) => {
  const saved = await writeSettings(ctx.settings, input);
  await changed(ctx);
  return saved;
};

export const getSettings = defineCommand({
  id: "get-settings",
  title: "Read Social radar settings",
  cli: true,
  run: (ctx) => readSettings(ctx.settings),
});

export const saveSettings = defineCommand({
  id: "save-settings",
  title: "Save Social radar settings",
  cli: true,
  params: { input: params.json({ required: true }) },
  run: (ctx, { input }) => save(ctx, input),
});

export const updateSite = defineCommand({
  id: "update-site",
  title: "Update site targets and budget",
  cli: true,
  params: { site: params.text({ required: true }), targets: params.list(), budget: params.number() },
  async run(ctx, { site, targets, budget }) {
    const key = siteSchema.parse(site);
    const current = await readSettings(ctx.settings);
    return save(ctx, {
      ...current,
      targets: { ...current.targets, [key]: targets ?? current.targets[key] },
      budgets: { ...current.budgets, [key]: budget ?? current.budgets[key] },
    });
  },
});

export const updateSettings = defineCommand({
  id: "update-settings",
  title: "Update research settings",
  cli: true,
  params: { input: params.json({ required: true }) },
  async run(ctx, { input }) {
    const patch = settingsSchema.partial().parse(input);
    return save(ctx, { ...(await readSettings(ctx.settings)), ...patch });
  },
});
