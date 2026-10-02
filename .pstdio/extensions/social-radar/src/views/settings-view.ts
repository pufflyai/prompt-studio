import { type ControlGroup, type ControlParam, type ControlValueMap, defineView } from "@pstdio/sdk/extensions";
import { type Run, type Site, sites } from "../schemas";
import { readSettings, writeSettings } from "../settings";
import { siteLabels } from "../sites";
import { changed, newest, radarChanged, runsOf } from "../store";
import { plural } from "../text";

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
const readList = (values: ControlValueMap, id: string) => {
  const value = values[id];
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
};

export const settingsView = defineView({
  id: "settings",
  title: "Social radar settings",
  icon: "settings",
  body: {
    kind: "controls",
    refreshEvents: [radarChanged],
    async query(ctx) {
      const settings = await readSettings(ctx.settings);
      const runs = newest(await runsOf(ctx).list(), (run) => run.startedAt);
      const groups: ControlGroup[] = [
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
          ],
        },
        {
          id: "writing",
          title: "Writing voice",
          description: "Instructions for every draft.",
          params: [{ id: "voice", type: "text", name: "Voice", defaultValue: settings.voice }],
        },
        ...sites.map(
          (site): ControlGroup => ({
            id: site,
            title: siteLabels[site],
            description: siteStatus(site, runs, settings.budgets[site], settings.targets[site].length),
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
              listControl(`targets-${site}`, "Targets", settings.targets[site]),
            ],
          }),
        ),
        {
          id: "scrolling",
          title: "Browse depth",
          collapsible: true,
          defaultCollapsed: true,
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
      const saved = await writeSettings(ctx.settings, {
        brandTerms: readList(values, "brandTerms"),
        topics: readList(values, "topics"),
        competitors: readList(values, "competitors"),
        voice: String(values.voice ?? "").trim(),
        targets: Object.fromEntries(sites.map((site) => [site, readList(values, `targets-${site}`)])),
        budgets: {
          ...Object.fromEntries(sites.map((site) => [site, values[`budget-${site}`]])),
          scrollScreens: values["scroll-screens"],
        },
      });
      await changed(ctx);
      return saved;
    },
  },
});
