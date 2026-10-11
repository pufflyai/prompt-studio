import { defineView, type NavigationTarget, type ResourceRef, type TreeNode } from "@pstdio/sdk/extensions";
import { pausedChannelIds } from "../channel-state";
import { commands } from "../commands";
import { readSettings } from "../settings";
import { builtInChannels } from "../sites";
import { channelResource, pageRef, radarChanged, settingsSection } from "../store";

export const sections = [
  { id: "research", label: "Research", icon: "Telescope" },
  { id: "voice", label: "Voice", icon: "PenLine" },
  { id: "agent", label: "Research agent", icon: "Bot" },
] as const;
type Section = (typeof sections)[number];
export type SettingsPart = { kind: "section"; id: Section["id"] } | { kind: "channel"; id: string };
export const settingsPartOf = (resource?: ResourceRef): SettingsPart => {
  if (resource?.type === channelResource.id) return { kind: "channel", id: resource.id };
  return { kind: "section", id: sections.find((section) => section.id === resource?.id)?.id ?? "research" };
};
const settingsTarget = (resource: ResourceRef) =>
  ({ kind: "page", page: pageRef("settings"), resource }) satisfies NavigationTarget;
export const sectionTarget = (section: Section = sections[0]) =>
  settingsTarget({ type: settingsSection.id, id: section.id, label: section.label });
const row = (
  id: string,
  label: string,
  icon: string,
  target: ReturnType<typeof settingsTarget>,
  open?: ResourceRef,
) => ({
  id,
  label,
  icon,
  resource: target.resource,
  target,
  selected: open?.type === target.resource.type && open.id === target.resource.id,
});
const channelIcon = (paused: boolean, url?: string) => {
  if (paused) return "Pause";
  return url ? "Globe" : "RadioTower";
};

/** Lists the settings sections and channels beside the settings view; each row opens the page on it. */
export const settingsMenu = defineView({
  id: "settings-menu",
  title: "Settings sections",
  body: {
    kind: "tree",
    refreshEvents: [radarChanged],
    defaultExpandedSectionIds: ["channels"],
    async body(ctx, { renderer }) {
      const { channels } = await readSettings(ctx.settings);
      const paused = await pausedChannelIds(ctx);
      const open = renderer.resource ?? sectionTarget().resource;
      const sectionNodes: TreeNode[] = sections.map((section) =>
        row(section.id, section.label, section.icon, sectionTarget(section), open),
      );
      const missing = builtInChannels.filter((builtIn) => !channels.some((channel) => channel.id === builtIn.id));
      return [
        { id: "sections", collapsible: false, nodes: sectionNodes },
        {
          id: "channels",
          label: "Channels",
          actions: [
            {
              id: "add-channel",
              label: "Add channel",
              icon: "Plus",
              command: commands["add-channel"].ref,
              input: {
                name: {
                  type: "select",
                  label: "Channel",
                  description: "Pick a built-in site, or type the name of a new one.",
                  options: missing.map((channel) => ({ label: channel.name, value: channel.name })),
                  allowCustomValues: true,
                  required: true,
                },
                url: { type: "text", label: "Link", description: "Where the agent reads a new channel." },
              },
              submitLabel: "Add",
            },
          ],
          nodes: channels.map((channel) => ({
            ...row(
              channel.id,
              channel.name,
              channelIcon(paused.has(channel.id), channel.url),
              settingsTarget({ type: channelResource.id, id: channel.id, label: channel.name }),
              open,
            ),
            actions: [
              {
                id: "set-channel-paused",
                label: paused.has(channel.id) ? "Resume channel" : "Pause channel",
                icon: paused.has(channel.id) ? "Play" : "Pause",
                command: commands["set-channel-paused"].ref,
                params: { id: channel.id, paused: !paused.has(channel.id) },
              },
              {
                id: "remove-channel",
                label: "Remove channel",
                icon: "Trash2",
                command: commands["remove-channel"].ref,
                params: { id: channel.id },
              },
            ],
          })),
        },
      ];
    },
  },
});
