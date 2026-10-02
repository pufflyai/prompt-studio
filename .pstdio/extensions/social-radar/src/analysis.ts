import { type FoundThread, isNewPost, type Sentiment, type Site, sentiments, type Thread } from "./schemas";

const day = 86_400_000;
const dayKey = (time: number) => new Date(time).toISOString().slice(0, 10);
const countBy = <T>(items: T[], key: (item: T) => string) => {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
};
const ranked = (counts: Map<string, number>, limit: number) =>
  [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
// "Got a reply" means someone answered the comment you posted.
const gotReply = (thread: FoundThread) => {
  const mine = new Set(thread.snapshot?.comments.filter((comment) => comment.mine).map((comment) => comment.id));
  return thread.snapshot?.comments.some((comment) => comment.parentId && mine.has(comment.parentId)) ?? false;
};

interface AnalysisInput {
  threads: Thread[];
  days: number;
  site?: Site;
  now?: number;
}

/** Adds up the tags the agent saved on threads; it never reads the sites. */
export const buildAnalysis = (input: AnalysisInput) => {
  const { threads, days, site, now = Date.now() } = input;
  const start = now - days * day;
  const inSite = threads.filter((thread) => !site || thread.site === site);
  const inWindow = (thread: Thread, from: number, to: number) => {
    const time = Date.parse(thread.foundAt);
    return time >= from && time < to;
  };
  const found = inSite.filter(
    (thread): thread is FoundThread => !isNewPost(thread) && inWindow(thread, start, now + 1),
  );
  const posts = inSite.filter((thread) => isNewPost(thread) && inWindow(thread, start, now + 1));
  const mentions = found.filter((thread) => thread.mention);
  const earlier = inSite.filter(
    (thread) => !isNewPost(thread) && thread.mention && inWindow(thread, start - days * day, start),
  ).length;
  const answered = found.filter((thread) => thread.status === "answered");
  const perDay = countBy(mentions, (thread) => dayKey(Date.parse(thread.foundAt)));
  const sentiment = Object.fromEntries(sentiments.map((value) => [value, 0])) as Record<Sentiment, number>;
  for (const thread of mentions) if (thread.analysis) sentiment[thread.analysis.sentiment] += 1;
  const topicCounts = new Map<string, number>();
  for (const thread of found) {
    for (const label of new Set(thread.analysis?.topics.map((topic) => topic.label)))
      topicCounts.set(label, (topicCounts.get(label) ?? 0) + 1);
  }
  return {
    days,
    mentions: { count: mentions.length, change: mentions.length - earlier },
    threadsFound: found.length,
    answered: { count: answered.length, gotReply: answered.filter(gotReply).length },
    postsUsed: { count: posts.filter((post) => post.status === "answered").length, total: posts.length },
    mentionsPerDay: Array.from({ length: days }, (_, index) => {
      const key = dayKey(now - (days - 1 - index) * day);
      return { day: key, count: perDay.get(key) ?? 0 };
    }),
    mentionSentiment: sentiment,
    mentionsBySite: ranked(
      countBy(mentions, (thread) => thread.site),
      8,
    ).map(([value, count]) => ({ site: value as Site, count })),
    topics: ranked(topicCounts, 8).map(([label, count]) => ({ label, count })),
    recentMentions: [...mentions]
      .sort((a, b) => b.foundAt.localeCompare(a.foundAt))
      .slice(0, 8)
      .map((thread) => ({
        id: thread.id,
        title: thread.title,
        site: thread.site,
        sentiment: thread.analysis?.sentiment ?? null,
        foundAt: thread.foundAt,
      })),
  };
};
export type RadarAnalysis = ReturnType<typeof buildAnalysis>;
