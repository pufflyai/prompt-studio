import { describe, expect, test } from "bun:test";
import type { Idea } from "../schemas";
import { commands } from ".";
import { foundThread, newPost, setup } from "./test-context";

describe("social radar reply ideas", () => {
  test("a reply idea answers a comment in the thread's snapshot", async () => {
    const { ctx, storage } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const thread = await commands["save-thread"].run(ctx, { input: foundThread(run.runId) });
    const idea = await commands["save-idea"].run(ctx, {
      input: { runId: run.runId, threadId: thread.id, replyTo: "c1", body: "A shared workspace helps." },
    });
    await commands["update-idea"].run(ctx, { id: idea.id, input: { body: "A shared board helps." } });
    await commands["set-idea-status"].run(ctx, { id: idea.id, status: "used" });
    expect(await storage.collection<Idea>("ideas").get(idea.id)).toMatchObject({
      threadId: thread.id,
      replyTo: "c1",
      body: "A shared board helps.",
      status: "used",
    });
    expect((await commands["get-thread"].run(ctx, { id: thread.id })).ideas).toHaveLength(1);
  });

  test("refuses a reply to an unknown comment or to a new post", async () => {
    const { ctx } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const thread = await commands["save-thread"].run(ctx, { input: foundThread(run.runId) });
    const post = await commands["save-thread"].run(ctx, { input: newPost(run.runId) });
    await expect(
      commands["save-idea"].run(ctx, { input: { runId: run.runId, threadId: thread.id, replyTo: "c9", body: "Hi" } }),
    ).rejects.toThrow("replyTo must name a comment");
    await expect(
      commands["save-idea"].run(ctx, { input: { runId: run.runId, threadId: post.id, body: "Hi" } }),
    ).rejects.toThrow("A new post has no reply ideas");
  });
});
