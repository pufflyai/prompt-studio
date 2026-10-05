import type { ExtensionSettingProperty, ExtensionSettingsApi } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { type Site, siteSchema, sites } from "./schemas";

const emptyTargets = Object.fromEntries(sites.map((site) => [site, [] as string[]])) as unknown as Record<
  Site,
  string[]
>;

export const defaults = {
  brandTerms: ["Prompt Studio", "pstdio"],
  topics: ["manage several coding agents", "internal tools with Claude Code", "agent workbench", "bespoke tools"],
  competitors: [] as string[],
  targets: { ...emptyTargets, reddit: ["r/ClaudeAI", "r/LocalLLaMA", "r/ChatGPTCoding"] },
  voice:
    "Prompt Studio is a workbench for bespoke tools. Explain how people can build tools that make their work easier. Sell the benefit. Be plain, friendly, and specific. Avoid hype and unsolicited promotion.",
  budgets: { hn: 4, reddit: 4, bluesky: 3, devto: 2, github: 2, youtube: 2, x: 3, linkedin: 3, scrollScreens: 3 },
};
const count = z.number().int().nonnegative().max(20);
const terms = z.array(z.string().trim().min(1));
export const settingsSchema = z.object({
  brandTerms: terms.min(1),
  topics: terms.min(1),
  competitors: terms,
  targets: z.record(siteSchema, terms),
  voice: z.string().trim().min(1),
  budgets: z.object({
    hn: count,
    reddit: count,
    bluesky: count,
    devto: count,
    github: count,
    youtube: count,
    x: count,
    linkedin: count,
    scrollScreens: count,
  }),
});
export type RadarSettings = z.infer<typeof settingsSchema>;
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
const settingType = (value: unknown) => {
  if (typeof value === "string") return "string";
  return Array.isArray(value) ? "array" : "object";
};
const titles: Record<string, string> = { brandTerms: "Brand terms", voice: "Writing voice" };
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
