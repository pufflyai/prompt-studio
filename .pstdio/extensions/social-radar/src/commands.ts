import { defineCommand, params, resourceMenuSlotRef } from "@pstdio/sdk/extensions";
import { completeRun, requireRun, requireRunning, startRun } from "./run-lifecycle";
import {
  finishRun,
  type Idea,
  ideaStatus,
  type Run,
  saveIdea,
  saveThread,
  siteSchema,
  type Thread,
  threadStatus,
  updateIdea,
  updateThread,
} from "./schemas";
import { readSettings, settingsSchema, writeSettings } from "./settings";
import { threadResource } from "./thread-resource";
import { canonicalThreadUrl, threadId } from "./urls";

const newest = <T>(items: T[], date: (item: T) => string) => items.sort((a, b) => date(b).localeCompare(date(a)));
const runDaily = defineCommand({ id: "run-daily", title: "Run Social radar", cli: true, run: startRun });
const getContext = defineCommand({
  id: "get-context",
  title: "Read research context",
  cli: true,
  params: { runId: params.text({ required: true }) },
  async run(ctx, { runId }) {
    await requireRun(ctx, runId);
    const settings = await readSettings(ctx.settings);
    const runs = newest(
      (await ctx.storage.collection<Run>("runs").list()).filter((run) => run.status === "done"),
      (run) => run.startedAt,
    );
    const since = runs[0]?.startedAt ?? new Date(Date.now() - 86400000).toISOString();
    const followUps = (await ctx.storage.collection<Thread>("threads").list()).filter(
      (thread) => thread.status === "posted" && !thread.outcomeCheckedAt,
    );
    const recentIdeas = (await ctx.storage.collection<Idea>("ideas").list())
      .filter((idea) => Date.parse(idea.createdAt) >= Date.now() - 14 * 86400000)
      .map((idea) => idea.title);
    return { ...settings, since, followUps, recentIdeas };
  },
});
const saveThreadCommand = defineCommand({
  id: "save-thread",
  title: "Save a thread",
  cli: true,
  params: { input: params.json({ required: true }) },
  async run(ctx, { input }) {
    const data = saveThread.parse(input);
    await requireRunning(ctx, data.runId);
    const url = canonicalThreadUrl(data.url);
    const id = threadId(url);
    const created = await ctx.storage
      .collection<Thread>("threads")
      .createIfAbsent(id, { ...data, url, id, status: "new", foundAt: new Date().toISOString() });
    return { id, created };
  },
});
const saveIdeaCommand = defineCommand({
  id: "save-idea",
  title: "Save a post idea",
  cli: true,
  params: { input: params.json({ required: true }) },
  async run(ctx, { input }) {
    const data = saveIdea.parse(input);
    await requireRunning(ctx, data.runId);
    const id = crypto.randomUUID();
    await ctx.storage
      .collection<Idea>("ideas")
      .put(id, { ...data, id, status: "new", createdAt: new Date().toISOString() });
    return { id };
  },
});
const updateThreadCommand = defineCommand({
  id: "update-thread",
  title: "Revise a thread",
  cli: true,
  params: { id: params.text({ required: true }), input: params.json({ required: true }) },
  async run(ctx, { id, input }) {
    const patch = updateThread.parse(input);
    const threads = ctx.storage.collection<Thread>("threads");
    const thread = await threads.get(id);
    if (!thread) throw new Error("Thread not found.");
    if (patch.outcome && thread.status !== "posted") throw new Error("Only a posted thread can have an outcome.");
    await threads.update(id, {
      ...thread,
      ...patch,
      community: patch.community === null ? undefined : (patch.community ?? thread.community),
      draftReply: patch.draftReply === null ? undefined : (patch.draftReply ?? thread.draftReply),
      outcome: patch.outcome === null ? undefined : (patch.outcome ?? thread.outcome),
      outcomeCheckedAt: patch.outcome
        ? new Date().toISOString()
        : patch.outcome === null
          ? undefined
          : thread.outcomeCheckedAt,
    });
    return { id };
  },
});
const updateIdeaCommand = defineCommand({
  id: "update-idea",
  title: "Revise a post idea",
  cli: true,
  params: { id: params.text({ required: true }), input: params.json({ required: true }) },
  async run(ctx, { id, input }) {
    const patch = updateIdea.parse(input);
    const ideas = ctx.storage.collection<Idea>("ideas");
    const idea = await ideas.get(id);
    if (!idea) throw new Error("Post idea not found.");
    await ideas.update(id, { ...idea, ...patch });
    return { id };
  },
});
const recordOutcome = defineCommand({
  id: "record-outcome",
  title: "Record a posted thread outcome",
  cli: true,
  params: { threadId: params.text({ required: true }), outcome: params.longText({ required: true }) },
  async run(ctx, input) {
    const threads = ctx.storage.collection<Thread>("threads");
    const thread = await threads.get(input.threadId);
    if (!thread || thread.status !== "posted") throw new Error("Posted thread not found.");
    if (!input.outcome.trim()) throw new Error("Write an outcome note.");
    await threads.update(thread.id, { ...thread, outcome: input.outcome, outcomeCheckedAt: new Date().toISOString() });
    return { id: thread.id };
  },
});
const finishRunCommand = defineCommand({
  id: "finish-run",
  title: "Finish research run",
  cli: true,
  params: { input: params.json({ required: true }) },
  run: (ctx, { input }) => completeRun(ctx, finishRun.parse(input)),
});
const listDigest = defineCommand({
  id: "list-digest",
  title: "Read daily digest",
  cli: true,
  params: { runId: params.text() },
  async run(ctx, { runId }) {
    const runs = newest(await ctx.storage.collection<Run>("runs").list(), (run) => run.startedAt);
    const run = runId ? await requireRun(ctx, runId) : (runs[0] ?? null);
    const threads = (await ctx.storage.collection<Thread>("threads").list()).filter(
      (thread) => thread.runId === run?.id && (thread.status === "new" || thread.status === "saved"),
    );
    threads.sort((a, b) => b.relevance - a.relevance);
    const ideas = (await ctx.storage.collection<Idea>("ideas").list()).filter(
      (idea) => idea.runId === run?.id && (idea.status === "new" || idea.status === "saved"),
    );
    return { run, threads, ideas };
  },
});
const listPosted = defineCommand({
  id: "list-posted",
  title: "Read posted history",
  cli: true,
  async run(ctx) {
    return {
      threads: newest(
        (await ctx.storage.collection<Thread>("threads").list()).filter((thread) => thread.status === "posted"),
        (thread) => thread.postedAt ?? "",
      ),
    };
  },
});
const setThreadStatus = defineCommand({
  id: "set-thread-status",
  title: "Update thread status",
  cli: true,
  params: { id: params.text({ required: true, resolvedFrom: "resource" }), status: params.text({ required: true }) },
  menus: [
    {
      slot: resourceMenuSlotRef(threadResource.ref, "header-actions"),
      label: "Save thread",
      params: { status: "saved" },
    },
    {
      slot: resourceMenuSlotRef(threadResource.ref, "header-actions"),
      label: "Mark posted",
      params: { status: "posted" },
    },
    {
      slot: resourceMenuSlotRef(threadResource.ref, "header-actions"),
      label: "Skip thread",
      params: { status: "skipped" },
    },
  ],
  async run(ctx, { id, status }) {
    const value = threadStatus.parse(status);
    const threads = ctx.storage.collection<Thread>("threads");
    const thread = await threads.get(id);
    if (!thread) throw new Error("Thread not found.");
    if (thread.status === "posted" && value !== "posted") throw new Error("Posted threads cannot be unposted.");
    const postedAt = value === "posted" ? (thread.postedAt ?? new Date().toISOString()) : undefined;
    await threads.update(id, {
      ...thread,
      status: value,
      postedAt,
      outcome: value === "posted" ? thread.outcome : undefined,
      outcomeCheckedAt: value === "posted" ? thread.outcomeCheckedAt : undefined,
    });
    return { id };
  },
});
const setIdeaStatus = defineCommand({
  id: "set-idea-status",
  title: "Update idea status",
  cli: true,
  params: { id: params.text({ required: true }), status: params.text({ required: true }) },
  async run(ctx, { id, status }) {
    const value = ideaStatus.parse(status);
    const ideas = ctx.storage.collection<Idea>("ideas");
    const idea = await ideas.get(id);
    if (!idea) throw new Error("Idea not found.");
    await ideas.update(id, { ...idea, status: value });
    return { id };
  },
});
const getSettings = defineCommand({
  id: "get-settings",
  title: "Read Social radar settings",
  cli: true,
  run: (ctx) => readSettings(ctx.settings),
});
const saveSettings = defineCommand({
  id: "save-settings",
  title: "Save Social radar settings",
  cli: true,
  params: { input: params.json({ required: true }) },
  async run(ctx, { input }) {
    return writeSettings(ctx.settings, input);
  },
});
const updateSite = defineCommand({
  id: "update-site",
  title: "Update site targets and budget",
  cli: true,
  params: { site: params.text({ required: true }), targets: params.list(), budget: params.number() },
  async run(ctx, { site, targets, budget }) {
    const key = siteSchema.parse(site);
    const current = await readSettings(ctx.settings);
    return writeSettings(ctx.settings, {
      ...current,
      targets: { ...current.targets, [key]: targets ?? current.targets[key] },
      budgets: { ...current.budgets, [key]: budget ?? current.budgets[key] },
    });
  },
});
const updateSettings = defineCommand({
  id: "update-settings",
  title: "Update research settings",
  cli: true,
  params: { input: params.json({ required: true }) },
  async run(ctx, { input }) {
    const patch = settingsSchema.partial().parse(input);
    const current = await readSettings(ctx.settings);
    return writeSettings(ctx.settings, { ...current, ...patch });
  },
});
export const commands = {
  runDaily,
  getContext,
  saveThread: saveThreadCommand,
  saveIdea: saveIdeaCommand,
  updateThread: updateThreadCommand,
  updateIdea: updateIdeaCommand,
  recordOutcome,
  finishRun: finishRunCommand,
  listDigest,
  listPosted,
  setThreadStatus,
  setIdeaStatus,
  getSettings,
  saveSettings,
  updateSite,
  updateSettings,
};
