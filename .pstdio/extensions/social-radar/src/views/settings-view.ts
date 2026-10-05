import { type ControlGroup, type ControlParam, type ControlValueMap, defineView } from "@pstdio/sdk/extensions";
import { type Run, type Site, sites } from "../schemas";
import { type RadarSettings, readSettings, writeSettings } from "../settings";
import { siteLabels } from "../sites";
import { changed, newest, radarChanged, runsOf } from "../store";
import { plural } from "../text";
import { type SectionId, sectionOf } from "./settings-menu";

const listControl = (id: string, name: string, values: string[], description?: string): ControlParam => ({
  id,
  type: "selection",
  name,
  description,
  multiSelect: true,
  allowCustomValues: true,
  searchable: true,
  placeholder: "Add values",
  defaultValue: values,
  options: values.map((value) => ({ id: value, name: value })),
});
// The group description is the site's status line: what it costs, or why recent runs skipped it.
const siteStatus = (site: Site, runs: Run[], budget: number, targets: number) => {
  const finished = runs.filter((run) => run.status === "done");
  let streak = 0;
  while (finished[streak]?.skippedSites?.some((skip) => skip.site === site)) streak += 1;
  const reason = finished[0]?.skippedSites?.find((skip) => skip.site === site)?.reason;
  if (streak && reason) return `Skipped on the last ${plural(streak, "run")}: ${reason}`;
  return `${plural(budget, "search", "searches")} · ${targets ? plural(targets, "target") : "no targets"}`;
};
// Budgets are plain number fields: a max would turn them into sliders, and the schema already caps them.
const countControl = (id: string, name: string, value: number): ControlParam => ({
  id,
  type: "number",
  name,
  defaultValue: value,
  min: 0,
  step: 1,
});
const sectionGroups = (section: SectionId, settings: RadarSettings, runs: Run[]): ControlGroup[] => {
  if (section === "voice")
    return [
      {
        id: "voice",
        title: "Writing voice",
        description: "Instructions for every draft.",
        params: [{ id: "voice", type: "text", name: "Voice", defaultValue: settings.voice, singleLine: false }],
      },
    ];
  if (section === "channels")
    return sites.map((site) => ({
      id: site,
      title: siteLabels[site],
      description: siteStatus(site, runs, settings.budgets[site], settings.targets[site].length),
      collapsible: true,
      defaultCollapsed: site !== "reddit",
      params: [
        countControl(`budget-${site}`, "Daily search budget", settings.budgets[site]),
        listControl(`targets-${site}`, "Targets", settings.targets[site]),
      ],
    }));
  return [
    {
      id: "research",
      title: "Research",
      description: "What the agent looks for.",
      params: [
        listControl(
          "brandTerms",
          "Brand terms",
          settings.brandTerms,
          "Always searched. A match marks the thread as a mention.",
        ),
        listControl("topics", "Topics", settings.topics),
        listControl("competitors", "Competitors", settings.competitors),
        countControl("scroll-screens", "Screens per search", settings.budgets.scrollScreens),
      ],
    },
  ];
};
// A section applies only its own controls, so every other setting keeps its saved value.
const applyValues = (settings: RadarSettings, values: ControlValueMap) => {
  const list = (id: string, saved: string[]) => {
    const value = values[id];
    return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : saved;
  };
  const count = (id: string, saved: number) => (id in values ? values[id] : saved);
  return {
    brandTerms: list("brandTerms", settings.brandTerms),
    topics: list("topics", settings.topics),
    competitors: list("competitors", settings.competitors),
    voice: "voice" in values ? String(values.voice).trim() : settings.voice,
    targets: Object.fromEntries(sites.map((site) => [site, list(`targets-${site}`, settings.targets[site])])),
    budgets: {
      ...Object.fromEntries(sites.map((site) => [site, count(`budget-${site}`, settings.budgets[site])])),
      scrollScreens: count("scroll-screens", settings.budgets.scrollScreens),
    },
  };
};

export const settingsView = defineView({
  id: "settings",
  title: "Social radar settings",
  icon: "settings",
  body: {
    kind: "controls",
    refreshEvents: [radarChanged],
    async query(ctx, { renderer }) {
      const settings = await readSettings(ctx.settings);
      const runs = newest(await runsOf(ctx).list(), (run) => run.startedAt);
      return {
        groups: sectionGroups(sectionOf(renderer.resource), settings, runs),
        values: {
          brandTerms: settings.brandTerms,
          topics: settings.topics,
          competitors: settings.competitors,
          voice: settings.voice,
          ...Object.fromEntries(
            sites.flatMap((site) => [
              [`budget-${site}`, settings.budgets[site]],
              [`targets-${site}`, settings.targets[site]],
            ]),
          ),
          "scroll-screens": settings.budgets.scrollScreens,
        },
      };
    },
    async onApply(ctx, { values }) {
      const saved = await writeSettings(ctx.settings, applyValues(await readSettings(ctx.settings), values));
      await changed(ctx);
      return saved;
    },
  },
});
