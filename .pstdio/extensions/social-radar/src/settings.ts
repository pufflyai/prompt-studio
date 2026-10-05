import type { ExtensionSettingProperty, ExtensionSettingsApi } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { builtInChannels } from "./sites";

export const defaults = {
  brandTerms: ["Prompt Studio", "pstdio", "prompt.studio"],
  // Topics are search queries, highest priority first, so they use the words people type in posts.
  topics: [
    "multiple Claude Code sessions",
    "parallel agents worktrees",
    "Claude Code GUI",
    "internal tools Claude Code",
    "build my own tool with AI",
    "Codex CLI workflow",
  ],
  competitors: ["Claude Squad", "Vibe Kanban", "conductor.build", "Cursor background agents"],
  voice:
    "Prompt Studio is a workbench for bespoke tools. Explain how people can build tools that make their work easier. Sell the benefit. Be plain, friendly, and specific. Avoid hype and unsolicited promotion.",
  scrollScreens: 3,
  channels: builtInChannels as Channel[],
  // Codex with gpt-6-astra has background computer use, so it can read X and LinkedIn while you work.
  agent: { harnessId: "pstdio.harness-codex.harness.codex", model: "gpt-6-astra" } as Agent,
};
const count = z.number().int().nonnegative().max(20);
const text = z.string().trim().min(1);
const terms = z.array(text);
export const channelSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: text,
  // Where to read a channel the skill has no recipe for; built-in channels leave it out.
  url: z.url().optional(),
  budget: count,
  targets: terms,
});
export const agentSchema = z.object({
  harnessId: text,
  model: text.optional(),
  params: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
});
export type Channel = z.infer<typeof channelSchema>;
export type Agent = z.infer<typeof agentSchema>;
export const settingsSchema = z.object({
  brandTerms: terms.min(1),
  topics: terms.min(1),
  competitors: terms,
  voice: text,
  scrollScreens: count,
  channels: z
    .array(channelSchema)
    .min(1, "Keep at least one channel.")
    .refine((channels) => new Set(channels.map((channel) => channel.id)).size === channels.length, {
      message: "Channel ids must be unique.",
    }),
  agent: agentSchema,
});
export type RadarSettings = z.infer<typeof settingsSchema>;
export const readSettings = async (settings: ExtensionSettingsApi) =>
  settingsSchema.parse({ ...defaults, ...(await settings.all()) });
export const writeSettings = async (settings: ExtensionSettingsApi, input: unknown) => {
  const data = settingsSchema.parse(input);
  for (const [key, value] of Object.entries(data)) await settings.set(key, value);
  return data;
};
const settingType = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number") return typeof value;
  return Array.isArray(value) ? "array" : "object";
};
const titles: Record<string, string> = {
  brandTerms: "Brand terms",
  voice: "Writing voice",
  scrollScreens: "Screens per search",
  agent: "Research agent",
};
export const settingProperties = Object.fromEntries(
  Object.entries(defaults).map(([key, value]) => [
    key,
    {
      type: settingType(value),
      scope: "project",
      default: value,
      title: titles[key] ?? key[0].toUpperCase() + key.slice(1),
    },
  ]),
) as Record<string, ExtensionSettingProperty>;
