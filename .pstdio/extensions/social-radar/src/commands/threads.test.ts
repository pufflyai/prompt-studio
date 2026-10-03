import { describe, expect, test } from "bun:test";
import type { Thread } from "../schemas";
import { commands } from ".";
import { finish, foundThread, newPost, setup } from "./test-context";

describe("social radar threads", () => {
  test("a posted URL belongs to only one saved thread", async () => {
    const { ctx, storage } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const first = await commands["save-thread"].run(ctx, { input: newPost(run.runId) });
    const second = await commands["save-thread"].run(ctx, { input: newPost(run.runId) });
    await commands["set-thread-status"].run(ctx, {
      id: first.id,
      status: "answered",
      url: "https://x.com/prompt_studio/status/1",
    });
    await expect(
      commands["set-thread-status"].run(ctx, {
        id: second.id,
        status: "answered",
        url: "https://X.com/prompt_studio/status/1/",
      }),
    ).rejects.toThrow("This link is already saved as a thread.");
    expect(await storage.collection<Thread>("threads").get(second.id)).toMatchObject({ status: "idea" });
  });
  test("saves a known thread URL once across runs", async () => {
    const { ctx, sessions } = setup();
    const first = await commands["run-daily"].run(ctx, {});
    const saved = await commands["save-thread"].run(ctx, { input: foundThread(first.runId) });
    await commands["finish-run"].run(ctx, { input: finish(first.runId) });
    sessions[0].status = "completed";
    const next = await commands["run-daily"].run(ctx, {});
    const again = await commands["save-thread"].run(ctx, {
      input: foundThread(next.runId, "https://NEWS.ycombinator.com/item/?id=42"),
    });
    expect(again).toEqual({ id: saved.id, created: false });
  });

  test("an answered thread keeps its answer and cannot move back", async () => {
    const { ctx, storage } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const saved = await commands["save-thread"].run(ctx, { input: foundThread(run.runId) });
    await commands["set-thread-status"].run(ctx, { id: saved.id, status: "answered" });
    const answered = await storage.collection<Thread>("threads").get(saved.id);
    expect(answered).toMatchObject({ status: "answered", answeredAt: expect.any(String) });
    for (const status of ["new", "skipped"])
      await expect(commands["set-thread-status"].run(ctx, { id: saved.id, status })).rejects.toThrow(
        "Answered threads cannot move back.",
      );
    expect(await storage.collection<Thread>("threads").get(saved.id)).toEqual(answered);
  });

  test("a new post is a thread that needs its link to become answered", async () => {
    const { ctx, storage } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const post = await commands["save-thread"].run(ctx, { input: newPost(run.runId) });
    expect(await storage.collection<Thread>("threads").get(post.id)).toMatchObject({ kind: "demo", status: "idea" });
    await expect(commands["set-thread-status"].run(ctx, { id: post.id, status: "answered" })).rejects.toThrow(
      "Paste the link",
    );
    await commands["set-thread-status"].run(ctx, {
      id: post.id,
      status: "answered",
      url: "https://x.com/prompt_studio/status/1/",
    });
    expect(await storage.collection<Thread>("threads").get(post.id)).toMatchObject({
      status: "answered",
      url: "https://x.com/prompt_studio/status/1",
    });
  });

  test("revises a thread's own fields and refuses fields of the other thread type", async () => {
    const { ctx, storage } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const found = await commands["save-thread"].run(ctx, { input: foundThread(run.runId) });
    const post = await commands["save-thread"].run(ctx, { input: newPost(run.runId) });
    await commands["update-thread"].run(ctx, { id: post.id, input: { draft: "A shorter draft." } });
    expect(await storage.collection<Thread>("threads").get(post.id)).toMatchObject({ draft: "A shorter draft." });
    await expect(commands["update-thread"].run(ctx, { id: found.id, input: { draft: "No" } })).rejects.toThrow(
      "This thread has no draft field.",
    );
    await expect(commands["update-thread"].run(ctx, { id: post.id, input: { relevance: 2 } })).rejects.toThrow(
      "This thread has no relevance field.",
    );
    await expect(commands["update-thread"].run(ctx, { id: found.id, input: { outcome: "Early" } })).rejects.toThrow(
      "Only an answered thread has an outcome.",
    );
  });

  test("a published post found again by a search is not saved twice", async () => {
    const { ctx, storage } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const post = await commands["save-thread"].run(ctx, { input: newPost(run.runId) });
    const link = "https://x.com/prompt_studio/status/1";
    await commands["set-thread-status"].run(ctx, { id: post.id, status: "answered", url: link });
    const found = await commands["save-thread"].run(ctx, {
      input: { ...foundThread(run.runId, link), site: "x", mention: true },
    });
    expect(found).toEqual({ id: post.id, created: false });
    expect(await storage.collection<Thread>("threads").list()).toHaveLength(1);
  });

  test("refuses a snapshot whose comments answer themselves", async () => {
    const { ctx } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const input = foundThread(run.runId);
    const comments = [
      { id: "a", parentId: "b", author: "sam", body: "One" },
      { id: "b", parentId: "a", author: "dana", body: "Two" },
    ];
    await expect(
      commands["save-thread"].run(ctx, { input: { ...input, snapshot: { ...input.snapshot, comments } } }),
    ).rejects.toThrow("answers itself");
  });

  test("found threads are new and new posts are ideas until answered or skipped", async () => {
    const { ctx, storage } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const found = await commands["save-thread"].run(ctx, { input: foundThread(run.runId) });
    const post = await commands["save-thread"].run(ctx, { input: newPost(run.runId) });
    await expect(commands["set-thread-status"].run(ctx, { id: found.id, status: "idea" })).rejects.toThrow(
      "Only a new post is an idea.",
    );
    await expect(commands["set-thread-status"].run(ctx, { id: post.id, status: "new" })).rejects.toThrow(
      "A new post is an idea, not a found thread.",
    );
    await commands["set-thread-status"].run(ctx, { id: post.id, status: "skipped" });
    await commands["set-thread-status"].run(ctx, { id: post.id, status: "idea" });
    expect(await storage.collection<Thread>("threads").get(post.id)).toMatchObject({ status: "idea" });
  });
});
