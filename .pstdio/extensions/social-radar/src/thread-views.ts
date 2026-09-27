import { defineView } from "@pstdio/sdk/extensions";
import { commands } from "./commands";
import type { Thread } from "./schemas";
import { threadResource } from "./thread-resource";

export const threadTable = defineView({
  id: "thread-table",
  title: "Saved threads",
  body: {
    kind: "dataTable",
    columns: [
      { id: "title", label: "Thread" },
      { id: "site", label: "Site" },
      { id: "community", label: "Community" },
      { id: "relevance", label: "Relevance" },
      { id: "status", label: "Status" },
    ],
    async query(ctx) {
      const threads = await ctx.storage.collection<Thread>("threads").list();
      threads.sort((a, b) => b.foundAt.localeCompare(a.foundAt));
      return {
        rows: threads.map((thread) => ({
          id: thread.id,
          values: {
            title: thread.title,
            site: thread.site,
            community: thread.community ?? "",
            relevance: thread.relevance,
            status: thread.status,
          },
          resource: { type: threadResource.id, id: thread.id, label: thread.title },
        })),
      };
    },
    onRowActivate(ctx, { row }) {
      if (!row.resource) return;
      ctx.navigation.open({ kind: "page", page: { kind: "page", id: "thread" }, resource: row.resource });
    },
  },
});

export const threadEditor = defineView({
  id: "thread-editor",
  title: "Thread details",
  body: {
    kind: "controls",
    async query(ctx, { renderer }) {
      const thread = await ctx.storage.collection<Thread>("threads").get(renderer.resource!.id);
      if (!thread) throw new Error("Thread not found.");
      return {
        groups: [
          {
            id: "source",
            title: "Source",
            params: [
              { id: "url", type: "readOnly", name: "URL", value: thread.url },
              { id: "site", type: "readOnly", name: "Site", value: thread.site },
              { id: "status", type: "readOnly", name: "Status", value: thread.status },
              { id: "title", type: "text", name: "Title", defaultValue: thread.title, singleLine: true },
              {
                id: "community",
                type: "text",
                name: "Community or channel",
                defaultValue: thread.community ?? "",
                singleLine: true,
              },
              { id: "topic", type: "text", name: "Topic", defaultValue: thread.topic, singleLine: true },
              {
                id: "relevance",
                type: "number",
                name: "Relevance",
                defaultValue: thread.relevance,
                min: 1,
                max: 3,
                step: 1,
              },
              {
                id: "intent",
                type: "selection",
                name: "Intent",
                defaultValue: thread.intent,
                options: [
                  { id: "asking-for-tool", name: "Asking for a tool" },
                  { id: "problem", name: "Problem" },
                  { id: "comparison", name: "Comparison" },
                  { id: "launch", name: "Launch" },
                  { id: "mention", name: "Mention" },
                  { id: "discussion", name: "Discussion" },
                ],
              },
            ],
          },
          {
            id: "response",
            title: "Research and reply",
            params: [
              { id: "excerpt", type: "text", name: "Excerpt", defaultValue: thread.excerpt },
              { id: "reason", type: "text", name: "Why it matters", defaultValue: thread.reason },
              { id: "draftReply", type: "text", name: "Draft reply", defaultValue: thread.draftReply ?? "" },
              ...(thread.status === "posted"
                ? [{ id: "outcome", type: "text" as const, name: "Outcome", defaultValue: thread.outcome ?? "" }]
                : []),
            ],
          },
        ],
        values: {
          title: thread.title,
          community: thread.community ?? "",
          topic: thread.topic,
          relevance: thread.relevance,
          intent: thread.intent,
          excerpt: thread.excerpt,
          reason: thread.reason,
          draftReply: thread.draftReply ?? "",
          ...(thread.status === "posted" ? { outcome: thread.outcome ?? "" } : {}),
        },
      };
    },
    async onApply(ctx, { renderer, values }) {
      const input = {
        title: String(values.title ?? ""),
        community: String(values.community ?? "").trim() || null,
        topic: String(values.topic ?? ""),
        relevance: Number(values.relevance),
        intent: String(values.intent ?? ""),
        excerpt: String(values.excerpt ?? ""),
        reason: String(values.reason ?? ""),
        draftReply: String(values.draftReply ?? "").trim() || null,
        ...(values.outcome !== undefined ? { outcome: String(values.outcome).trim() || null } : {}),
      };
      const result = await ctx.commands.execute(commands.updateThread.ref, {
        params: { id: renderer.resource!.id, input },
      });
      if (result.status !== "success") throw new Error(result.reason ?? "Could not save thread.");
    },
  },
});
