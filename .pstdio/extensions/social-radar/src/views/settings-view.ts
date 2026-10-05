import { type ControlGroup, type ControlParam, type ControlValueMap, defineView } from "@pstdio/sdk/extensions";
import type { Run } from "../schemas";
import { type Channel, type RadarSettings, readSettings, writeSettings } from "../settings";
import { changed, newest, radarChanged, runsOf } from "../store";
import { plural } from "../text";
import { type SettingsPart, settingsPartOf } from "./settings-menu";

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
// Budgets are plain number fields: a max would turn them into sliders, and the schema already caps them.
const countControl = (id: string, name: string, value: number): ControlParam => ({
  id,
  type: "number",
  name,
  defaultValue: value,
  min: 0,
  step: 1,
});
const readOnly = (id: string, name: string, value: string): ControlParam => ({ id, type: "readOnly", name, value });
// Harness option keys such as model_reasoning_effort read as "Model reasoning effort".
const optionName = (key: string) => {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
// The group description is the channel's status line: what it costs, or why recent runs skipped it.
const channelStatus = (channel: Channel, runs: Run[]) => {
  const finished = runs.filter((run) => run.status === "done");
  let streak = 0;
  while (finished[streak]?.skippedSites?.some((skip) => skip.site === channel.id)) streak += 1;
  const reason = finished[0]?.skippedSites?.find((skip) => skip.site === channel.id)?.reason;
  if (streak && reason) return `Skipped on the last ${plural(streak, "run")}: ${reason}`;
  const targets = channel.targets.length ? plural(channel.targets.length, "target") : "no targets";
  return `${plural(channel.budget, "search", "searches")} · ${targets}`;
};
const channelGroup = (channel: Channel | undefined, runs: Run[]): ControlGroup => {
  if (!channel)
    return {
      id: "channel",
      title: "Channel removed",
      params: [readOnly("removed", "Status", "Add it again from Channels in the menu.")],
    };
  const params = [
    countControl(`budget-${channel.id}`, "Daily search budget", channel.budget),
    listControl(`targets-${channel.id}`, "Targets", channel.targets),
  ];
  // Built-in channels have a search recipe in the skill; other channels are read at their link.
  if (channel.url)
    params.push({ id: `url-${channel.id}`, type: "text", name: "Link", defaultValue: channel.url, singleLine: true });
  return { id: channel.id, title: channel.name, description: channelStatus(channel, runs), params };
};
const partGroups = (part: SettingsPart, settings: RadarSettings, runs: Run[]): ControlGroup[] => {
  if (part.kind === "channel")
    return [
      channelGroup(
        settings.channels.find((channel) => channel.id === part.id),
        runs,
      ),
    ];
  if (part.id === "voice")
    return [
      {
        id: "voice",
        title: "Writing voice",
        description: "Instructions for every draft.",
        params: [{ id: "voice", type: "text", name: "Voice", defaultValue: settings.voice, singleLine: false }],
      },
    ];
  if (part.id === "agent") {
    const { harnessId, model, params = {} } = settings.agent;
    return [
      {
        id: "agent",
        title: "Research agent",
        description:
          "The harness and model that run each morning's session. Change them with Choose model in the menu.",
        params: [
          readOnly("harness", "Harness", harnessId),
          readOnly("model", "Model", model ?? "Harness default"),
          ...Object.entries(params).map(([key, value]) => readOnly(`param-${key}`, optionName(key), String(value))),
        ],
      },
    ];
  }
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
        countControl("scroll-screens", "Screens per search", settings.scrollScreens),
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
  const textValue = (id: string, saved: string | undefined) => (id in values ? String(values[id]).trim() : saved);
  return {
    ...settings,
    brandTerms: list("brandTerms", settings.brandTerms),
    topics: list("topics", settings.topics),
    competitors: list("competitors", settings.competitors),
    voice: textValue("voice", settings.voice),
    scrollScreens: count("scroll-screens", settings.scrollScreens),
    channels: settings.channels.map((channel) => ({
      ...channel,
      budget: count(`budget-${channel.id}`, channel.budget),
      targets: list(`targets-${channel.id}`, channel.targets),
      url: textValue(`url-${channel.id}`, channel.url),
    })),
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
        groups: partGroups(settingsPartOf(renderer.resource), settings, runs),
        values: {
          brandTerms: settings.brandTerms,
          topics: settings.topics,
          competitors: settings.competitors,
          voice: settings.voice,
          "scroll-screens": settings.scrollScreens,
          ...Object.fromEntries(
            settings.channels.flatMap((channel) => [
              [`budget-${channel.id}`, channel.budget],
              [`targets-${channel.id}`, channel.targets],
              ...(channel.url ? [[`url-${channel.id}`, channel.url]] : []),
            ]),
          ),
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
