import { defineCommand, params } from "@pstdio/sdk/extensions";
import { completeRun, requireRun, startRun } from "../run-lifecycle";
import { finishRun, isNewPost, type Thread } from "../schemas";
import { readSettings } from "../settings";
import { mediaRuleOf } from "../sites";
import { ideasOf, newest, runsOf, threadsOf } from "../store";
import { localDay } from "../text";

const day = 86_400_000;
const followUpDays = 7;
const answeredSummary = (thread: Thread) => ({
  id: thread.id,
  site: thread.site,
  url: thread.url,
  title: thread.title,
  answeredAt: thread.answeredAt,
  outcome: thread.outcome,
});

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
    // A run that skipped a channel did not read it, so the channel keeps its earlier window.
    const sinceFor = (channelId: string) =>
      finished.find((item) => item.searches?.[channelId] && !item.skippedSites?.some((skip) => skip.site === channelId))
        ?.startedAt ?? new Date(Date.now() - day).toISOString();
    const today = localDay(run.startedAt);
    const threads = await threadsOf(ctx).list();
    // Follow up for a week after answering, at most once a day, so old answers stop costing searches.
    const followUps = threads
      .filter(
        (thread) =>
          thread.status === "answered" &&
          Date.parse(thread.answeredAt ?? "") >= Date.now() - followUpDays * day &&
          (!thread.outcomeCheckedAt || localDay(thread.outcomeCheckedAt) !== today),
      )
      .map(answeredSummary);
    const recentPosts = threads
      .filter((thread) => isNewPost(thread) && Date.parse(thread.foundAt) >= Date.now() - 14 * day)
      .map((thread) => thread.title);
    const { agent, ...research } = settings;
    const channels = settings.channels.map((channel) => ({
      ...channel,
      mediaRule: mediaRuleOf(channel.id),
      since: sinceFor(channel.id),
    }));
    return { ...research, channels, followUps, recentPosts };
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
    return { threads: newest(answered, (thread) => thread.answeredAt ?? "").map(answeredSummary) };
  },
});
