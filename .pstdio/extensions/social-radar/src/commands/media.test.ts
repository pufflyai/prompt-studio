import { describe, expect, test } from "bun:test";
import { commands } from ".";
import { foundThread, newPost, setup } from "./test-context";

describe("social radar post media", () => {
  test("copies workspace files into the thread's folder within the site's media rule", async () => {
    const { ctx, media, workspace } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const post = await commands["save-thread"].run(ctx, { input: newPost(run.runId) });
    for (const name of ["one.png", "two.png", "three.png", "four.png", "five.png", "clip.mp4"])
      await workspace.writeBytes(`shots/${name}`, new Uint8Array([1]));
    for (const name of ["one.png", "two.png", "three.png", "four.png"])
      await commands["add-media"].run(ctx, { threadId: post.id, path: `shots/${name}` });
    expect([...media.files.keys()]).toHaveLength(4);
    await expect(commands["add-media"].run(ctx, { threadId: post.id, path: "shots/five.png" })).rejects.toThrow(
      "does not fit the media rule",
    );
    // X takes images or a video, not both.
    await expect(commands["add-media"].run(ctx, { threadId: post.id, path: "shots/clip.mp4" })).rejects.toThrow(
      "does not fit the media rule",
    );
  });

  test("refuses media on a site that takes none", async () => {
    const { ctx, workspace } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const thread = await commands["save-thread"].run(ctx, { input: foundThread(run.runId) });
    await workspace.writeBytes("shot.png", new Uint8Array([1]));
    await expect(commands["add-media"].run(ctx, { threadId: thread.id, path: "shot.png" })).rejects.toThrow(
      "does not fit the media rule for hn",
    );
  });
});
