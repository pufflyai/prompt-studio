import { type ControlGroup, type ControlValueMap, defineView } from "@pstdio/sdk/extensions";
import { type Site, sites } from "./schemas";
import { readSettings, writeSettings } from "./settings";

const labels: Record<Site, string> = {
  hn: "Hacker News",
  reddit: "Reddit",
  bluesky: "Bluesky",
  devto: "DEV Community",
  github: "GitHub",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
};
const listParams = (id: string, label: string, items: string[]) =>
  [...items, ""].map((value, index) => ({
    id: `${id}-${index}`,
    type: "text" as const,
    name: index === items.length ? `Add ${label.toLowerCase()}` : `${label} ${index + 1}`,
    defaultValue: value,
    singleLine: true,
  }));
const valuesForList = (id: string, items: string[]) =>
  Object.fromEntries([...items, ""].map((value, index) => [`${id}-${index}`, value]));
const readList = (values: ControlValueMap, id: string) =>
  Object.entries(values)
    .filter(([key]) => key.startsWith(`${id}-`))
    .map(([, value]) => String(value ?? "").trim())
    .filter(Boolean);
const readText = (values: ControlValueMap, id: string) => String(values[id] ?? "").trim();

export const settingsView = defineView({
  id: "settings-controls",
  title: "Social radar settings",
  icon: "settings",
  body: {
    kind: "controls",
    async query(ctx) {
      const settings = await readSettings(ctx.settings);
      const groups: ControlGroup[] = [
        {
          id: "research",
          title: "Research topics",
          description: "Clear a field to remove it. Use the empty field to add another.",
          params: [
            ...listParams("topic", "Topic", settings.topics),
            ...listParams("competitor", "Competitor", settings.competitors),
          ],
        },
        {
          id: "writing",
          title: "Writing voice",
          params: [{ id: "voice", type: "text", name: "Agent instructions", defaultValue: settings.voice }],
        },
        ...sites.map(
          (site): ControlGroup => ({
            id: site,
            title: labels[site],
            description:
              "Targets can be communities, accounts, repositories, channels, or search spaces for this site.",
            collapsible: true,
            defaultCollapsed: site !== "reddit",
            params: [
              {
                id: `budget-${site}`,
                type: "number",
                name: "Daily search budget",
                defaultValue: settings.budgets[site],
                min: 0,
                max: 20,
                step: 1,
              },
              ...listParams(`target-${site}`, "Target", settings.targets[site]),
            ],
          }),
        ),
        {
          id: "scrolling",
          title: "Browse depth",
          params: [
            {
              id: "scroll-screens",
              type: "number",
              name: "Screens per search",
              defaultValue: settings.budgets.scrollScreens,
              min: 0,
              max: 20,
              step: 1,
            },
          ],
        },
      ];
      return {
        groups,
        values: {
          ...valuesForList("topic", settings.topics),
          ...valuesForList("competitor", settings.competitors),
          voice: settings.voice,
          ...Object.fromEntries(
            sites.flatMap((site) => [
              [`budget-${site}`, settings.budgets[site]],
              ...Object.entries(valuesForList(`target-${site}`, settings.targets[site])),
            ]),
          ),
          "scroll-screens": settings.budgets.scrollScreens,
        },
      };
    },
    async onApply(ctx, { values }) {
      const current = await readSettings(ctx.settings);
      return writeSettings(ctx.settings, {
        ...current,
        topics: readList(values, "topic"),
        competitors: readList(values, "competitor"),
        voice: readText(values, "voice"),
        targets: Object.fromEntries(sites.map((site) => [site, readList(values, `target-${site}`)])),
        budgets: {
          ...Object.fromEntries(sites.map((site) => [site, values[`budget-${site}`]])),
          scrollScreens: values["scroll-screens"],
        },
      });
    },
  },
});
