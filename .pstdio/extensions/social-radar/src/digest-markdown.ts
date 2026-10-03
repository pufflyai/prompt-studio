import { type FoundThread, type Idea, isNewPost, type NewPost, type Run, sites, type Thread } from "./schemas";
import { siteLabels } from "./sites";
import { plural } from "./text";

const time = (value: string) => new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const statusLabel = { running: "Running", done: "Done", failed: "Failed" };
const ideaCount = (thread: Thread, ideas: Idea[]) => ideas.filter((idea) => idea.threadId === thread.id).length;
// Titles and reasons come from scraped sites, so Markdown syntax in them is escaped.
const escapeMarkdown = (value: string) => value.replace(/\s+/g, " ").replace(/([\\`*_[\]()|#<>])/g, "\\$1");
const link = (thread: Thread) =>
  thread.url ? `[${escapeMarkdown(thread.title)}](<${thread.url}>)` : escapeMarkdown(thread.title);
const foundLine = (thread: FoundThread, ideas: Idea[]) => {
  const count = ideaCount(thread, ideas);
  const details = [siteLabels[thread.site], thread.analysis?.sentiment, count ? plural(count, "idea") : ""];
  return `- ${link(thread)} · ${details.filter(Boolean).join(" · ")}`;
};
const postLine = (post: NewPost) => {
  const sources = post.basedOn?.length ? ` · ${post.basedOn.join(", ")}` : "";
  return `- ${escapeMarkdown(post.title)} · ${siteLabels[post.site]} · ${post.kind}${escapeMarkdown(sources)}`;
};
const section = (title: string, lines: string[], empty: string) => [
  `## ${title}`,
  "",
  ...(lines.length ? lines : [empty]),
  "",
];
const coverageResult = (run: Run, site: (typeof sites)[number]) => {
  const skipped = run.skippedSites?.find((skip) => skip.site === site);
  if (skipped) return `Skipped: ${escapeMarkdown(skipped.reason)}`;
  return run.searches?.[site] ? "Read" : "Not searched";
};

/** The run's read-only digest: meta line, summary, mentions, answer today, new posts, and coverage. */
export const buildDigestMarkdown = (run: Run, threads: Thread[], ideas: Idea[], budgets: Record<string, number>) => {
  const found = threads.filter((thread): thread is FoundThread => !isNewPost(thread));
  const posts = threads.filter(isNewPost);
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
  const coverage = sites.map(
    (site) =>
      `| ${siteLabels[site]} | ${run.searches?.[site] ?? 0} of ${budgets[site]} | ${coverageResult(run, site)} |`,
  );
  return [
    `_${meta.join(" · ")}_`,
    "",
    escapeMarkdown(run.summary ?? run.failureReason ?? "The agent is still working. Results appear as it saves them."),
    "",
    ...section(
      "Mentions",
      mentions.map((thread) => foundLine(thread, ideas)),
      "No mentions in this run.",
    ),
    ...section(
      "Answer today",
      answerToday.map((thread) => foundLine(thread, ideas)),
      "Nothing to answer today.",
    ),
    ...section("New posts", posts.map(postLine), "No new posts in this run."),
    "## Coverage",
    "",
    "| Site | Searches | Result |",
    "| --- | --- | --- |",
    ...coverage,
    "",
  ].join("\n");
};
