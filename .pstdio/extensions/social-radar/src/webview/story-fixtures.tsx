import type { GuestHost } from "@pstdio/sdk/extensions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { buildAnalysis } from "../analysis";
import type { FoundThread, Idea, NewPost } from "../schemas";
import { type RadarClient, RadarContext } from "./client";

const now = Date.parse("2026-09-28T07:14:00.000Z");
const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000).toISOString();

export const storyThread: FoundThread = {
  id: "thread-1",
  runId: "run-1",
  site: "reddit",
  url: "https://www.reddit.com/r/ClaudeAI/comments/abc/tried_prompt_studio",
  title: "Tried Prompt Studio for my review flow, some notes",
  community: "r/ClaudeAI",
  excerpt: "I tried Prompt Studio to build a small review page.",
  topic: "Prompt Studio",
  mention: true,
  intent: "mention",
  relevance: 3,
  reason: "A first-hand review that names Prompt Studio.",
  status: "answered",
  foundAt: hoursAgo(20),
  answeredAt: hoursAgo(18),
  outcome: "23 upvotes, 4 replies. The poster will try the review page again.",
  snapshot: {
    takenAt: hoursAgo(1),
    post: {
      author: "u/devtools_dana",
      publishedAt: hoursAgo(22),
      body: "I review a lot of agent diffs every day, so I tried Prompt Studio to build a small review page. It took an evening. Setup was the slow part. Has anyone else done this on Windows?",
      score: 142,
      commentCount: 38,
    },
    comments: [
      {
        id: "c1",
        author: "u/agent_wrangler",
        publishedAt: hoursAgo(20),
        body: "Setup on Windows took me an hour.",
        votes: 41,
        topic: "Windows setup",
      },
      {
        id: "c2",
        parentId: "c1",
        author: "u/devtools_dana",
        publishedAt: hoursAgo(19),
        body: "Same here, macOS was fine.",
        votes: 12,
      },
      {
        id: "c3",
        parentId: "c1",
        author: "u/prompt_studio_au",
        publishedAt: hoursAgo(18),
        body: "The desktop app now installs without WSL; the setup guide covers it in two steps.",
        votes: 23,
        mine: true,
      },
      {
        id: "c4",
        author: "u/cursor_fan",
        publishedAt: hoursAgo(16),
        body: "How does this compare to Cursor's background agents?",
        votes: 9,
        topic: "comparisons to Cursor",
      },
    ],
  },
  analysis: {
    summary: "The poster built a review page in an evening and liked it. The main complaint is Windows setup.",
    sentiment: "positive",
    replySentiment: { negative: 6, neutral: 12, positive: 20 },
    topics: [
      { label: "review flow", count: 11 },
      { label: "Windows setup", count: 7 },
      { label: "comparisons to Cursor", count: 5 },
    ],
    questions: ["Does it work on Windows without WSL?", "How does it compare to Cursor background agents?"],
  },
};

export const storyIdeas: Idea[] = [
  {
    id: "idea-1",
    runId: "run-1",
    threadId: "thread-1",
    replyTo: "c4",
    body: "Different jobs. Background agents run a task in the cloud and push a branch. Prompt Studio is where you build the tools around that work, like this review page.",
    status: "new",
    createdAt: hoursAgo(1),
  },
];

export const storyPost: NewPost = {
  id: "post-1",
  runId: "run-1",
  kind: "demo",
  site: "x",
  title: "Review page for agent diffs, built in ten minutes",
  draft:
    "I review agent diffs all day, so I built a review page for them in Prompt Studio. Ten minutes: I described the page and the agent built it. #BuildInPublic",
  reason: "Two threads this week show people building review pages for agent diffs.",
  tags: ["#BuildInPublic", "#AIagents"],
  basedOn: ["thread-1", "abc1234"],
  status: "idea",
  foundAt: hoursAgo(1),
};

export const storyAnalysis = buildAnalysis({
  now,
  days: 14,
  threads: Array.from({ length: 14 }, (_, index) => ({
    ...storyThread,
    id: `mention-${index}`,
    site: (["reddit", "hn", "x"] as const)[index % 3],
    title: `${storyThread.title} (${index + 1})`,
    foundAt: hoursAgo(index * 20 + 1),
    status: index % 4 ? "new" : "answered",
    analysis: { ...storyThread.analysis!, sentiment: (["positive", "neutral", "negative"] as const)[index % 3] },
  })),
});

const client = {
  artifacts: { list: async () => [], readText: async () => "", imageUrl: async () => "" },
  events: { subscribe: () => () => {} },
} as unknown as RadarClient;
const queryClient = new QueryClient();

/** Gives stories the radar context without a host; commands are not called. */
export const RadarStory = (props: { children: ReactNode }) => {
  const { children } = props;
  return (
    <QueryClientProvider client={queryClient}>
      <RadarContext.Provider
        value={{
          host: {} as GuestHost,
          client,
          propsStore: { get: () => ({}), subscribe: () => () => {} },
        }}
      >
        {children}
      </RadarContext.Provider>
    </QueryClientProvider>
  );
};
