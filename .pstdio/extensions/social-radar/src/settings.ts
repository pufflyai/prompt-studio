import type { ExtensionSettingProperty, ExtensionSettingsApi } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { type Site, siteSchema, sites } from "./schemas";

const emptyTargets = Object.fromEntries(sites.map((site) => [site, [] as string[]])) as unknown as Record<
  Site,
  string[]
>;

export const defaults = {
  topics: ["manage several coding agents", "internal tools with Claude Code", "agent workbench", "bespoke tools"],
  competitors: [] as string[],
  targets: { ...emptyTargets, reddit: ["r/ClaudeAI", "r/LocalLLaMA", "r/ChatGPTCoding"] },
  voice:
    "Prompt Studio is a workbench for bespoke tools. Explain how people can build tools that make their work easier. Sell the benefit. Be plain, friendly, and specific. Avoid hype and unsolicited promotion.",
  budgets: { hn: 4, reddit: 4, bluesky: 3, devto: 2, github: 2, youtube: 2, x: 3, linkedin: 3, scrollScreens: 3 },
};
const count = z.number().int().nonnegative().max(20);
const budgetSchema = z.object({
  hn: count,
  reddit: count,
  bluesky: count,
  devto: count,
  github: count,
  youtube: count,
  x: count,
  linkedin: count,
  scrollScreens: count,
});
export const settingsSchema = z.object({
  topics: z.array(z.string().trim().min(1)).min(1),
  competitors: z.array(z.string().trim().min(1)),
  targets: z.record(siteSchema, z.array(z.string().trim().min(1))),
  voice: z.string().trim().min(1),
  budgets: budgetSchema,
});
export const readSettings = async (settings: ExtensionSettingsApi) => {
  const values = await settings.all();
  return settingsSchema.parse({
    ...defaults,
    ...values,
    budgets: { ...defaults.budgets, ...(values.budgets as object) },
    targets: { ...defaults.targets, ...(values.targets as object) },
  });
};
export const writeSettings = async (settings: ExtensionSettingsApi, input: unknown) => {
  const data = settingsSchema.parse(input);
  for (const [key, value] of Object.entries(data)) await settings.set(key, value);
  return data;
};
export const settingProperties = Object.fromEntries(
  Object.entries(defaults).map(([key, value]) => [
    key,
    {
      type: typeof value === "string" ? "string" : Array.isArray(value) ? "array" : "object",
      scope: "project",
      default: value,
      title: key === "voice" ? "Writing voice" : key[0].toUpperCase() + key.slice(1),
    },
  ]),
) as Record<string, ExtensionSettingProperty>;
