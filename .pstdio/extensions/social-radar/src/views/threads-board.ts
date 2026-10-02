import {
  defineView,
  type KanbanRendererAttributeDescriptor,
  type KanbanRendererSavedView,
  type KanbanRendererSettings,
} from "@pstdio/sdk/extensions";
import { commands } from "../commands";
import { type Idea, isNewPost, sites, type Thread } from "../schemas";
import { siteLabels } from "../sites";
import { ideasOf, pageRef, radarChanged, threadRef, threadsOf } from "../store";

const statusOptions = [
  { value: "new", label: "New", icon: "status-todo", color: "purple" },
  { value: "saved", label: "Saved", icon: "status-review", color: "yellow" },
  { value: "answered", label: "Answered", icon: "status-done", color: "green" },
  { value: "skipped", label: "Skipped", icon: "status-canceled", color: "gray" },
];
const attributes: KanbanRendererAttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    type: { kind: "enum", options: statusOptions },
    editable: true,
    filterable: true,
    groupable: true,
  },
  {
    id: "type",
    label: "Type",
    type: {
      kind: "enum",
      options: [
        { value: "thread", label: "Threads" },
        { value: "post", label: "Post ideas" },
      ],
    },
    filterable: true,
    groupable: true,
    displayable: false,
  },
  // The badge icon list has no at-sign, so the label carries it.
  {
    id: "mention",
    label: "Mention",
    type: { kind: "enum", options: [{ value: "mention", label: "@ Mention" }] },
    filterable: true,
  },
  { id: "ideas", label: "Ideas", type: { kind: "string" } },
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
    type: { kind: "enum", options: sites.map((site) => ({ value: site, label: siteLabels[site] })) },
    filterable: true,
    groupable: true,
  },
  { id: "found", label: "Found", type: { kind: "date" }, sortable: true },
  { id: "relevance", label: "Relevance", type: { kind: "number" }, sortable: true, displayable: false },
];
const settings: KanbanRendererSettings = {
  viewMode: "list",
  columnGrouping: "type",
  rowGrouping: "status",
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
  return `${count} idea${count === 1 ? "" : "s"}`;
};

export const threadsBoard = defineView({
  id: "threads",
  title: "Threads",
  icon: "list",
  body: {
    kind: "kanban",
    attributes,
    defaultSettings: settings,
    defaultViews: [
      view("active", "Active", { status: ["new", "saved", "answered"] }),
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
      return {
        rows: threads.map((thread) => ({
          id: thread.id,
          title: thread.title,
          resource: threadRef(thread),
          attributes: {
            status: thread.status,
            type: isNewPost(thread) ? "post" : "thread",
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
