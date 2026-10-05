import { createMemoryRepoFiles, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";

export const setup = () => {
  const storage = createMemoryStorage();
  const notifications: { title: string }[] = [];
  const events: unknown[] = [];
  const sessions: { id: string; title: string; status: string }[] = [];
  const settings = new Map<string, unknown>();
  const media = createMemoryRepoFiles();
  const workspace = createMemoryRepoFiles();
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      sessions: {
        create: async (input) => {
          const session = { ...input, id: crypto.randomUUID(), status: "queued" as const, type: "session" as const };
          sessions.push(session);
          return session;
        },
        get: async (id) => sessions.find((session) => session.id === id) ?? null,
      },
      settings: {
        get: async (key) => settings.get(key),
        all: async () => Object.fromEntries(settings),
        set: async (key, value) => {
          settings.set(key, value);
        },
      },
      notify: {
        action: async (input) => {
          notifications.push(input);
          return { ...input, id: "notice" } as never;
        },
      },
      events: {
        emit: async (_event, payload) => {
          events.push(payload);
          return { delivered: 1 } as never;
        },
      },
      artifacts: { mount: () => media },
      workspaceFiles: workspace as never,
    },
  });
  return { ctx, storage, notifications, events, sessions, settings, media, workspace };
};

export const foundThread = (runId: string, url = "https://news.ycombinator.com/item?id=42&utm_source=x") => ({
  runId,
  site: "hn" as const,
  url,
  title: "How do you manage several agents?",
  excerpt: "I need a workbench.",
  topic: "coding agents",
  mention: false,
  intent: "asking-for-tool" as const,
  relevance: 3 as const,
  reason: "Direct tool request",
  snapshot: {
    takenAt: "2026-09-28T07:00:00.000Z",
    post: { author: "dana", body: "I need a workbench." },
    comments: [{ id: "c1", author: "sam", body: "Same here." }],
  },
});

export const newPost = (runId: string) => ({
  runId,
  kind: "demo" as const,
  site: "x" as const,
  title: "Review page for agent diffs",
  draft: "I built a review page in ten minutes.",
  reason: "Two threads ask for review pages.",
  tags: ["#BuildInPublic"],
  basedOn: ["abc123"],
});

export const finish = (runId: string) => ({
  runId,
  summary: "Found one useful discussion.",
  searches: { hn: 1 },
  skippedSites: [{ site: "x", reason: "No browser tool" }],
});
