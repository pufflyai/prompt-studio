import { describe, expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { commands } from "./commands";
import type { Run, Thread } from "./schemas";

const setup = () => {
  const storage = createMemoryStorage();
  const notifications: unknown[] = [];
  const sessions: { id: string; title: string; status: string }[] = [];
  const settings = new Map<string, unknown>();
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
    },
  });
  return { ctx, storage, notifications, sessions, settings };
};
const thread = (runId: string, url = "https://news.ycombinator.com/item?id=42&utm_source=x") => ({
  runId,
  site: "hn" as const,
  url,
  title: "How do you manage several agents?",
  excerpt: "I need a workbench.",
  topic: "coding agents",
  intent: "asking-for-tool" as const,
  relevance: 3 as const,
  reason: "Direct tool request",
  draftReply: "Here is a way to do it.",
});
const finish = (runId: string) => ({
  runId,
  summary: "Found one useful discussion.",
  searches: { hn: 1 },
  skippedSites: [{ site: "x", reason: "No browser tool" }],
});

describe("social radar commands", () => {
  test("starts one session for overlapping runs and reconciles ended sessions", async () => {
    const { ctx, sessions, storage } = setup();
    const [first, second] = await Promise.all([commands.runDaily.run(ctx, {}), commands.runDaily.run(ctx, {})]);
    expect(sessions).toHaveLength(1);
    expect(second).toMatchObject({ runId: first.runId, alreadyRunning: true });
    expect(sessions[0]).toMatchObject({
      harness: { harnessId: "pstdio.harness-codex.harness.codex", model: "gpt-6-astra" },
    });
    sessions[0].status = "completed";
    await commands.runDaily.run(ctx, {});
    expect(sessions).toHaveLength(2);
    expect(await storage.collection<Run>("runs").get(first.runId)).toMatchObject({ status: "failed" });
  });
  test("deduplicates canonical URLs across digests and preserves posted status", async () => {
    const { ctx, sessions } = setup();
    const first = await commands.runDaily.run(ctx, {});
    const saved = await commands.saveThread.run(ctx, { input: thread(first.runId) });
    await commands.setThreadStatus.run(ctx, { id: saved.id, status: "posted" });
    await commands.finishRun.run(ctx, { input: finish(first.runId) });
    sessions[0].status = "completed";
    const next = await commands.runDaily.run(ctx, {});
    expect(
      await commands.saveThread.run(ctx, { input: thread(next.runId, "https://NEWS.ycombinator.com/item/?id=42") }),
    ).toEqual({ id: saved.id, created: false });
    expect((await commands.listDigest.run(ctx, {})).threads).toHaveLength(0);
    expect((await commands.listPosted.run(ctx, {})).threads[0]).toMatchObject({
      id: saved.id,
      status: "posted",
      postedAt: expect.any(String),
    });
  });
  test("reads edited settings, finished-run cutoff and unchecked posted follow-ups", async () => {
    const { ctx, settings, storage } = setup();
    settings.set("topics", ["bespoke tools"]);
    settings.set("voice", "Be brief.");
    settings.set("budgets", { hn: 1, x: 0 });
    const run = await commands.runDaily.run(ctx, {});
    const saved = await commands.saveThread.run(ctx, { input: thread(run.runId) });
    await commands.setThreadStatus.run(ctx, { id: saved.id, status: "posted" });
    await commands.finishRun.run(ctx, { input: finish(run.runId) });
    const context = await commands.getContext.run(ctx, { runId: run.runId });
    expect(context).toMatchObject({
      topics: ["bespoke tools"],
      voice: "Be brief.",
      budgets: { hn: 1, x: 0, reddit: 4 },
    });
    const completedRun = await storage.collection<Run>("runs").get(run.runId);
    if (!completedRun) throw new Error("Missing completed run");
    expect(context.since).toBe(completedRun.startedAt);
    expect(context.followUps).toHaveLength(1);
    await commands.recordOutcome.run(ctx, { threadId: saved.id, outcome: "No response" });
    expect((await commands.getContext.run(ctx, { runId: run.runId })).followUps).toHaveLength(0);
  });
  test("finishes once, saves ideas and rejects invalid agent input", async () => {
    const { ctx, notifications } = setup();
    const run = await commands.runDaily.run(ctx, {});
    await commands.saveIdea.run(ctx, {
      input: {
        runId: run.runId,
        kind: "demo",
        title: "Show the workbench",
        body: "A ready-to-paste draft",
        sites: ["x"],
        tags: ["#BuildInPublic"],
        basedOn: ["abc123"],
      },
    });
    await commands.finishRun.run(ctx, { input: finish(run.runId) });
    await commands.finishRun.run(ctx, { input: finish(run.runId) });
    expect(notifications).toHaveLength(1);
    expect((await commands.listDigest.run(ctx, {})).ideas).toHaveLength(1);
    await expect(commands.saveThread.run(ctx, { input: { ...thread(run.runId), relevance: 8 } })).rejects.toThrow();
    await expect(commands.recordOutcome.run(ctx, { threadId: "missing", outcome: "No response" })).rejects.toThrow();
  });
  test("retries completion when its notification could not be saved", async () => {
    const { ctx, storage, notifications } = setup();
    const run = await commands.runDaily.run(ctx, {});
    const action = ctx.notify.action;
    ctx.notify.action = async () => {
      throw new Error("Notification unavailable");
    };
    await expect(commands.finishRun.run(ctx, { input: finish(run.runId) })).rejects.toThrow("Notification unavailable");
    expect(await storage.collection<Run>("runs").get(run.runId)).toMatchObject({ status: "running" });
    ctx.notify.action = action;
    await commands.finishRun.run(ctx, { input: finish(run.runId) });
    expect(notifications).toHaveLength(1);
    expect(await storage.collection<Run>("runs").get(run.runId)).toMatchObject({ status: "done" });
  });
  test("session creation failure leaves a failed run", async () => {
    const { ctx, storage } = setup();
    ctx.sessions.create = async () => {
      throw new Error("Codex harness is not enabled");
    };
    await expect(commands.runDaily.run(ctx, {})).rejects.toThrow("Codex harness");
    const runs = await storage.collection<Run>("runs").list();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "failed", failureReason: "Codex harness is not enabled" });
  });

  test("updates one site's research targets without replacing other settings", async () => {
    const { ctx } = setup();
    await commands.updateSite.run(ctx, {
      site: "reddit",
      targets: ["r/LocalLLaMA", "r/ChatGPTCoding"],
      budget: 2,
    });
    const settings = await commands.getSettings.run(ctx, {});
    expect(settings.targets.reddit).toEqual(["r/LocalLLaMA", "r/ChatGPTCoding"]);
    expect(settings.targets.bluesky).toEqual([]);
    expect(settings.budgets).toMatchObject({ reddit: 2, hn: 4 });
    await commands.updateSite.run(ctx, { site: "reddit", budget: 1 });
    expect((await commands.getSettings.run(ctx, {})).targets.reddit).toEqual(["r/LocalLLaMA", "r/ChatGPTCoding"]);
    await commands.updateSettings.run(ctx, { input: { topics: ["agent workflow"], competitors: ["Another tool"] } });
    expect(await commands.getSettings.run(ctx, {})).toMatchObject({
      topics: ["agent workflow"],
      competitors: ["Another tool"],
      targets: { reddit: ["r/LocalLLaMA", "r/ChatGPTCoding"] },
      budgets: { reddit: 1, hn: 4 },
    });
  });

  test("revises a saved thread without losing its posting history", async () => {
    const { ctx, storage } = setup();
    const run = await commands.runDaily.run(ctx, {});
    const saved = await commands.saveThread.run(ctx, { input: thread(run.runId) });
    await commands.setThreadStatus.run(ctx, { id: saved.id, status: "posted" });
    const original = await storage.collection<Thread>("threads").get(saved.id);
    await commands.updateThread.run(ctx, {
      id: saved.id,
      input: { title: "A clearer question", community: "r/ClaudeAI", relevance: 2, draftReply: "A better draft." },
    });
    expect((await commands.listPosted.run(ctx, {})).threads[0]).toMatchObject({
      id: saved.id,
      runId: run.runId,
      status: "posted",
      postedAt: original?.postedAt,
      title: "A clearer question",
      community: "r/ClaudeAI",
      relevance: 2,
      draftReply: "A better draft.",
    });
    await expect(commands.updateThread.run(ctx, { id: saved.id, input: { relevance: 9 } })).rejects.toThrow();
  });

  test("keeps posting history when a posted thread is saved or skipped again", async () => {
    const { ctx, storage } = setup();
    const run = await commands.runDaily.run(ctx, {});
    const saved = await commands.saveThread.run(ctx, { input: thread(run.runId) });
    await commands.setThreadStatus.run(ctx, { id: saved.id, status: "posted" });
    await commands.recordOutcome.run(ctx, { threadId: saved.id, outcome: "A reader replied." });
    const posted = await storage.collection<Thread>("threads").get(saved.id);
    await expect(commands.setThreadStatus.run(ctx, { id: saved.id, status: "saved" })).rejects.toThrow(
      "Posted threads cannot be unposted.",
    );
    await expect(commands.setThreadStatus.run(ctx, { id: saved.id, status: "skipped" })).rejects.toThrow(
      "Posted threads cannot be unposted.",
    );
    expect(await storage.collection<Thread>("threads").get(saved.id)).toEqual(posted);
  });

  test("revises an idea draft while keeping its saved status", async () => {
    const { ctx, storage } = setup();
    const run = await commands.runDaily.run(ctx, {});
    const saved = await commands.saveIdea.run(ctx, {
      input: { runId: run.runId, kind: "demo", title: "Demo", body: "First draft", sites: ["x"], tags: [] },
    });
    await commands.setIdeaStatus.run(ctx, { id: saved.id, status: "saved" });
    await commands.updateIdea.run(ctx, { id: saved.id, input: { body: "Revised draft", sites: ["x", "linkedin"] } });
    expect(await storage.collection("ideas").get(saved.id)).toMatchObject({
      id: saved.id,
      status: "saved",
      body: "Revised draft",
      sites: ["x", "linkedin"],
    });
  });
});
