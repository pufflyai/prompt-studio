import { defineCommand, params } from "@pstdio/sdk/extensions";
import { completeRun, requireRun, startRun } from "../run-lifecycle";
import { finishRun, isNewPost } from "../schemas";
import { readSettings } from "../settings";
import { mediaRules } from "../sites";
import { ideasOf, newest, runsOf, threadsOf } from "../store";

const day = 86_400_000;

export const runDaily = defineCommand({ id: "run-daily", title: "Run Social radar", cli: true, run: startRun });

export const getContext = defineCommand({
  id: "get-context",
  title: "Read research context",
  cli: true,
  params: { runId: params.text({ required: true }) },
  async run(ctx, { runId }) {
    const run = await requireRun(ctx, runId);
    const settings = await readSettings(ctx.settings);
    const finished = newest(
      (await runsOf(ctx).list()).filter((item) => item.status === "done"),
      (item) => item.startedAt,
    );
    const since = finished[0]?.startedAt ?? new Date(Date.now() - day).toISOString();
    const today = run.startedAt.slice(0, 10);
    const threads = await threadsOf(ctx).list();
    const followUps = threads.filter(
      (thread) => thread.status === "answered" && !thread.outcomeCheckedAt?.startsWith(today),
    );
    const recentPosts = threads
      .filter((thread) => isNewPost(thread) && Date.parse(thread.foundAt) >= Date.now() - 14 * day)
      .map((thread) => thread.title);
    return { ...settings, mediaRules, since, followUps, recentPosts };
  },
});

export const finishRunCommand = defineCommand({
  id: "finish-run",
  title: "Finish research run",
  cli: true,
  params: { input: params.json({ required: true }) },
  run: (ctx, { input }) => completeRun(ctx, finishRun.parse(input)),
});

export const listDigest = defineCommand({
  id: "list-digest",
  title: "Read a run digest",
  cli: true,
  params: { runId: params.text() },
  async run(ctx, { runId }) {
    const runs = newest(await runsOf(ctx).list(), (item) => item.startedAt);
    const run = runId ? await requireRun(ctx, runId) : (runs[0] ?? null);
    const threads = (await threadsOf(ctx).list()).filter((thread) => thread.runId === run?.id);
    const ideas = (await ideasOf(ctx).list()).filter((idea) => idea.runId === run?.id);
    return { run, threads, ideas };
  },
});

export const listAnswered = defineCommand({
  id: "list-answered",
  title: "Read answered threads",
  cli: true,
  async run(ctx) {
    const answered = (await threadsOf(ctx).list()).filter((thread) => thread.status === "answered");
    return { threads: newest(answered, (thread) => thread.answeredAt ?? "") };
  },
});
