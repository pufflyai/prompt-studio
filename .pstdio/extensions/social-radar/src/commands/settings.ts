import { defineCommand, params } from "@pstdio/sdk/extensions";
import { type Channel, readSettings, settingsSchema, writeSettings } from "../settings";
import { builtInChannels } from "../sites";
import { changed } from "../store";

const save = async (ctx: Parameters<typeof changed>[0], input: unknown) => {
  const saved = await writeSettings(ctx.settings, input);
  await changed(ctx);
  return saved;
};
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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

export const updateChannel = defineCommand({
  id: "update-channel",
  title: "Update channel targets and budget",
  cli: true,
  params: { id: params.text({ required: true }), targets: params.list(), budget: params.number() },
  async run(ctx, { id, targets, budget }) {
    const current = await readSettings(ctx.settings);
    if (!current.channels.some((channel) => channel.id === id)) throw new Error(`${id} is not a channel.`);
    const channels = current.channels.map((channel) =>
      channel.id === id
        ? { ...channel, targets: targets ?? channel.targets, budget: budget ?? channel.budget }
        : channel,
    );
    return save(ctx, { ...current, channels });
  },
});

export const addChannel = defineCommand({
  id: "add-channel",
  title: "Add a channel",
  cli: true,
  params: {
    name: params.text({ required: true, label: "Channel", description: "A built-in site, or the name of a new one." }),
    url: params.text({ label: "Link", description: "Where the agent reads a new channel, such as https://lobste.rs." }),
  },
  async run(ctx, { name, url }) {
    const current = await readSettings(ctx.settings);
    const builtIn = builtInChannels.find((channel) => channel.name.toLowerCase() === name.trim().toLowerCase());
    const channel: Channel = builtIn ?? { id: slug(name), name: name.trim(), url, budget: 2, targets: [] };
    if (current.channels.some((saved) => saved.id === channel.id))
      throw new Error(`${channel.name} is already a channel.`);
    if (!builtIn && !url) throw new Error("Add a link where the agent can read this channel.");
    return save(ctx, { ...current, channels: [...current.channels, channel] });
  },
});

export const removeChannel = defineCommand({
  id: "remove-channel",
  title: "Remove a channel",
  cli: true,
  params: { id: params.text({ required: true }) },
  async run(ctx, { id }) {
    const current = await readSettings(ctx.settings);
    const channels = current.channels.filter((channel) => channel.id !== id);
    if (!channels.length) throw new Error("The radar needs at least one channel.");
    return save(ctx, { ...current, channels });
  },
});

export const setAgent = defineCommand({
  id: "set-agent",
  title: "Choose the research agent",
  cli: true,
  params: { agent: params.harness({ label: "Model", required: true }) },
  async run(ctx, { agent }) {
    return save(ctx, { ...(await readSettings(ctx.settings)), agent });
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
