import type { FoundThread, Idea, NewPost, Run, Thread } from "./schemas";
import { isNewPost } from "./schemas";
import type { Channel } from "./settings";
import { channelNames } from "./sites";
import { plural } from "./text";

const time = (value: string) => new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const statusLabel = { running: "Running", done: "Done", failed: "Failed" };
const ideaCount = (thread: Thread, ideas: Idea[]) => ideas.filter((idea) => idea.threadId === thread.id).length;
// Titles and reasons come from scraped sites, so Markdown syntax in them is escaped.
// Parentheses stay plain: escaped brackets already stop links, and the file view reads \( ... \) as math.
const escapeMarkdown = (value: string) => value.replace(/\s+/g, " ").replace(/([\\`*_[\]|#<>])/g, "\\$1");
const link = (thread: Thread) =>
  thread.url ? `[${escapeMarkdown(thread.title)}](<${thread.url}>)` : escapeMarkdown(thread.title);
const foundLine = (thread: FoundThread, ideas: Idea[], names: Record<string, string>) => {
  const count = ideaCount(thread, ideas);
  const details = [names[thread.site] ?? thread.site, thread.analysis?.sentiment, count ? plural(count, "idea") : ""];
  return `- ${link(thread)} · ${details.filter(Boolean).join(" · ")}`;
};
// basedOn mixes thread ids with commit SHAs and changeset names; only saved threads have titles.
const postLine = (post: NewPost, titles: Map<string, string>, names: Record<string, string>) => {
  const sources = post.basedOn?.length
    ? ` · ${post.basedOn.map((source) => titles.get(source) ?? source).join(", ")}`
    : "";
  return `- ${escapeMarkdown(post.title)} · ${names[post.site] ?? post.site} · ${post.kind}${escapeMarkdown(sources)}`;
};
const section = (title: string, lines: string[], empty: string) => [
  `## ${title}`,
  "",
  ...(lines.length ? lines : [empty]),
  "",
];
const coverageResult = (run: Run, site: string) => {
  const skipped = run.skippedSites?.find((skip) => skip.site === site);
  if (skipped) return `Skipped: ${escapeMarkdown(skipped.reason)}`;
  return run.searches?.[site] ? "Read" : "Not searched";
};

/**
 * The run's read-only digest: meta line, summary, mentions, answer today, new posts, and coverage.
 * `threads` holds every saved thread, so new-post sources from earlier runs keep their titles.
 */
export const buildDigestMarkdown = (run: Run, threads: Thread[], ideas: Idea[], channels: Channel[]) => {
  const names = channelNames(channels);
  const runThreads = threads.filter((thread) => thread.runId === run.id);
  const titles = new Map(threads.map((thread) => [thread.id, thread.title]));
  const found = runThreads.filter((thread): thread is FoundThread => !isNewPost(thread));
  const posts = runThreads.filter(isNewPost);
  const mentions = found.filter((thread) => thread.mention);
  const answerToday = found.filter((thread) => !thread.mention && thread.relevance === 3);
  const searches = Object.values(run.searches ?? {}).reduce((total, count) => total + count, 0);
  const span = run.finishedAt ? `${time(run.startedAt)} – ${time(run.finishedAt)}` : time(run.startedAt);
  const meta = [
    statusLabel[run.status],
    span,
    plural(searches, "search", "searches"),
    plural(found.length, "thread"),
    plural(mentions.length, "mention"),
  ];
  const coverage = channels.map(
    (channel) =>
      `| ${escapeMarkdown(channel.name)} | ${run.searches?.[channel.id] ?? 0} of ${channel.budget} | ${coverageResult(run, channel.id)} |`,
  );
  return [
    `_${meta.join(" · ")}_`,
    "",
    escapeMarkdown(run.summary ?? run.failureReason ?? "The agent is still working. Results appear as it saves them."),
    "",
    ...section(
      "Mentions",
      mentions.map((thread) => foundLine(thread, ideas, names)),
      "No mentions in this run.",
    ),
    ...section(
      "Answer today",
      answerToday.map((thread) => foundLine(thread, ideas, names)),
      "Nothing to answer today.",
    ),
    ...section(
      "New posts",
      posts.map((post) => postLine(post, titles, names)),
      "No new posts in this run.",
    ),
    "## Coverage",
    "",
    "| Channel | Searches | Result |",
    "| --- | --- | --- |",
    ...coverage,
    "",
  ].join("\n");
};
