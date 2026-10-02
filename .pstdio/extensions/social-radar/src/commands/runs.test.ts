import { describe, expect, test } from "bun:test";
import type { Run } from "../schemas";
import { commands } from ".";
import { finish, foundThread, newPost, setup } from "./test-context";

describe("social radar runs", () => {
  test("starts one session for overlapping runs and fails runs whose session ended", async () => {
    const { ctx, sessions, storage } = setup();
    const [first, second] = await Promise.all([commands["run-daily"].run(ctx, {}), commands["run-daily"].run(ctx, {})]);
    expect(sessions).toHaveLength(1);
    expect(second).toMatchObject({ runId: first.runId, alreadyRunning: true });
    expect(sessions[0]).toMatchObject({
      harness: { harnessId: "pstdio.harness-codex.harness.codex", model: "gpt-6-astra" },
    });
    sessions[0].status = "completed";
    await commands["run-daily"].run(ctx, {});
    expect(sessions).toHaveLength(2);
    expect(await storage.collection<Run>("runs").get(first.runId)).toMatchObject({ status: "failed" });
  });

  test("finishes once and names mentions and threads in its one notification", async () => {
    const { ctx, notifications } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    await commands["save-thread"].run(ctx, { input: { ...foundThread(run.runId), mention: true } });
    await commands["save-thread"].run(ctx, { input: newPost(run.runId) });
    await commands["finish-run"].run(ctx, { input: finish(run.runId) });
    await commands["finish-run"].run(ctx, { input: finish(run.runId) });
    expect(notifications.map((notice) => notice.title)).toEqual(["Social radar: 1 mention, 1 thread"]);
  });

  test("rejects a run that reports more searches than the site's budget", async () => {
    const { ctx, settings } = setup();
    settings.set("budgets", { hn: 1 });
    const run = await commands["run-daily"].run(ctx, {});
    await expect(
      commands["finish-run"].run(ctx, { input: { ...finish(run.runId), searches: { hn: 2 } } }),
    ).rejects.toThrow("Search budget exceeded for hn.");
  });

  test("retries completion when its notification could not be saved", async () => {
    const { ctx, storage, notifications } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const action = ctx.notify.action;
    ctx.notify.action = async () => {
      throw new Error("Notification unavailable");
    };
    await expect(commands["finish-run"].run(ctx, { input: finish(run.runId) })).rejects.toThrow();
    ctx.notify.action = action;
    await commands["finish-run"].run(ctx, { input: finish(run.runId) });
    expect(notifications).toHaveLength(1);
    expect(await storage.collection<Run>("runs").get(run.runId)).toMatchObject({ status: "done" });
  });

  test("leaves a failed run when the session cannot start", async () => {
    const { ctx, storage } = setup();
    ctx.sessions.create = async () => {
      throw new Error("Codex harness is not enabled");
    };
    await expect(commands["run-daily"].run(ctx, {})).rejects.toThrow("Codex harness");
    expect(await storage.collection<Run>("runs").list()).toMatchObject([
      { status: "failed", failureReason: "Codex harness is not enabled" },
    ]);
  });

  test("gives the agent brand terms, media rules, follow-ups and recent posts", async () => {
    const { ctx, storage } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const saved = await commands["save-thread"].run(ctx, { input: foundThread(run.runId) });
    await commands["save-thread"].run(ctx, { input: newPost(run.runId) });
    await commands["set-thread-status"].run(ctx, { id: saved.id, status: "answered" });
    await commands["finish-run"].run(ctx, { input: finish(run.runId) });
    const context = await commands["get-context"].run(ctx, { runId: run.runId });
    const finished = await storage.collection<Run>("runs").get(run.runId);
    expect(context).toMatchObject({
      brandTerms: ["Prompt Studio", "pstdio"],
      mediaRules: { x: { images: 4, videos: 1, either: true } },
      since: finished?.startedAt,
      recentPosts: ["Review page for agent diffs"],
    });
    expect(context.followUps.map((thread) => thread.id)).toEqual([saved.id]);
    await commands["record-outcome"].run(ctx, { threadId: saved.id, outcome: "No response" });
    expect((await commands["get-context"].run(ctx, { runId: run.runId })).followUps).toHaveLength(0);
  });
});
