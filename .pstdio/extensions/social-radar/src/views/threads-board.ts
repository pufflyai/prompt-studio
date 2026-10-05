import {
  defineView,
  type KanbanRendererAttributeDescriptor,
  type KanbanRendererSavedView,
  type KanbanRendererSettings,
} from "@pstdio/sdk/extensions";
import { commands } from "../commands";
import { type Idea, isNewPost, type Thread } from "../schemas";
import { readSettings } from "../settings";
import { channelNames } from "../sites";
import { ideasOf, pageRef, radarChanged, threadRef, threadsOf } from "../store";
import { plural } from "../text";

// One level: threads to join are New, posts to publish are Ideas.
const statusOptions = [
  { value: "new", label: "New", icon: "status-todo", color: "purple" },
  { value: "idea", label: "Ideas", icon: "lightbulb", color: "yellow" },
  { value: "answered", label: "Answered", icon: "status-done", color: "green" },
  { value: "skipped", label: "Skipped", icon: "status-canceled", color: "gray" },
];
// Site options follow the configured channels, so the query returns the attributes.
const attributes = (sites: { value: string; label: string }[]): KanbanRendererAttributeDescriptor[] => [
  {
    id: "status",
    label: "Status",
    type: { kind: "enum", options: statusOptions },
    editable: true,
    filterable: true,
    groupable: true,
  },
  // The badge icon list has no at-sign, so the label carries it.
  {
    id: "mention",
    label: "Mention",
    type: { kind: "enum", options: [{ value: "mention", label: "@ Mention" }] },
    filterable: true,
  },
  { id: "ideas", label: "Reply ideas", type: { kind: "string" } },
  {
    id: "kind",
    label: "Kind",
    type: {
      kind: "enum",
      options: [
        { value: "demo", label: "Demo" },
        { value: "topic", label: "Topic" },
        { value: "showcase", label: "Showcase" },
      ],
    },
    filterable: true,
  },
  {
    id: "site",
    label: "Site",
    type: { kind: "enum", options: sites },
    filterable: true,
    groupable: true,
  },
  { id: "found", label: "Found", type: { kind: "date" }, sortable: true },
  { id: "relevance", label: "Relevance", type: { kind: "number" }, sortable: true, displayable: false },
];
const settings: KanbanRendererSettings = {
  viewMode: "list",
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: { attributeId: "relevance", direction: "desc" },
  displayProperties: ["mention", "ideas", "kind", "site", "found"],
};
const view = (id: string, title: string, filters: Record<string, string[]>): KanbanRendererSavedView => ({
  id,
  title,
  settings,
  filters,
});
const ideaCount = (thread: Thread, ideas: Idea[]) => {
  const count = ideas.filter((idea) => idea.threadId === thread.id && idea.status !== "dismissed").length;
  if (!count) return undefined;
  return plural(count, "reply idea");
};

export const threadsBoard = defineView({
  id: "threads",
  title: "Threads",
  icon: "list",
  body: {
    kind: "kanban",
    defaultSettings: settings,
    defaultViews: [
      view("active", "Active", { status: ["new", "idea"] }),
      view("mentions", "Mentions", { mention: ["mention"] }),
      view("answered", "Answered", { status: ["answered"] }),
      view("all", "All", {}),
    ],
    defaultActiveViewId: "active",
    refreshEvents: [radarChanged],
    async query(ctx) {
      const ideas = await ideasOf(ctx).list();
      // Newest first, so equal relevance falls back to the date.
      const threads = (await threadsOf(ctx).list()).sort((a, b) => b.foundAt.localeCompare(a.foundAt));
      const { channels } = await readSettings(ctx.settings);
      const names = channelNames(channels);
      const sites = [...new Set([...channels.map((channel) => channel.id), ...threads.map((thread) => thread.site)])];
      return {
        attributes: attributes(sites.map((site) => ({ value: site, label: names[site] ?? site }))),
        rows: threads.map((thread) => ({
          id: thread.id,
          title: thread.title,
          resource: threadRef(thread),
          attributes: {
            status: thread.status,
            mention: !isNewPost(thread) && thread.mention ? "mention" : undefined,
            ideas: isNewPost(thread) ? undefined : ideaCount(thread, ideas),
            kind: isNewPost(thread) ? thread.kind : undefined,
            site: thread.site,
            found: thread.foundAt,
            relevance: isNewPost(thread) ? 0 : thread.relevance,
          },
        })),
      };
    },
    onRowActivate(ctx, { row }) {
      ctx.navigation.open({ kind: "page", page: pageRef("thread"), resource: row.resource });
    },
    async onAttributeChange(ctx, { rowId, attributeId, value }) {
      if (attributeId !== "status") throw new Error("Only the status can change here.");
      const result = await ctx.commands.execute(commands["set-thread-status"].ref, {
        params: { id: rowId, status: String(value) },
      });
      if (result.status !== "success") throw new Error(result.reason ?? "Could not change the status.");
    },
  },
});
