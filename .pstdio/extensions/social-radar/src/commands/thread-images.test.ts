import { describe, expect, test } from "bun:test";
import type { FoundThread } from "../schemas";
import { commands } from ".";
import { foundThread, setup } from "./test-context";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

const savedThread = async () => {
  const context = setup();
  const run = await commands["run-daily"].run(context.ctx, {});
  const { id } = await commands["save-thread"].run(context.ctx, { input: foundThread(run.runId) });
  const read = async () => (await commands["get-thread"].run(context.ctx, { id })).thread as FoundThread;
  return { ...context, id, read };
};

describe("social radar thread images", () => {
  test("keeps copies of a post's and a comment's images with the snapshot", async () => {
    const { ctx, id, read, threadMedia, workspace } = await savedThread();
    await workspace.writeBytes("downloads/diagram.png", png);
    await workspace.writeBytes("downloads/reply.webp", new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "));
    await commands["add-thread-image"].run(ctx, { threadId: id, path: "downloads/diagram.png", alt: "Agent diagram" });
    await commands["add-thread-image"].run(ctx, { threadId: id, path: "downloads/reply.webp", commentId: "c1" });
    const { snapshot } = await read();
    expect(snapshot?.post.images).toEqual([{ file: "diagram.png", alt: "Agent diagram" }]);
    expect(snapshot?.comments[0].images).toEqual([{ file: "reply.webp" }]);
    expect(await threadMedia.readBytes(`${id}/diagram.png`)).toEqual(png);
  });

  test("takes at most four images, only image files, and only for saved comments", async () => {
    const { ctx, id, workspace } = await savedThread();
    for (const name of ["1.png", "2.png", "3.png", "4.png", "5.png", "clip.mp4"])
      await workspace.writeBytes(`downloads/${name}`, png);
    // A blocked download saves the site's error page under the image's name.
    await workspace.writeBytes("downloads/blocked.png", new TextEncoder().encode("<html>403 Forbidden</html>"));
    await expect(commands["add-thread-image"].run(ctx, { threadId: id, path: "downloads/blocked.png" })).rejects.toThrow(
      "downloads/blocked.png is not an image. Check the download.",
    );
    await expect(commands["add-thread-image"].run(ctx, { threadId: id, path: "downloads/clip.mp4" })).rejects.toThrow(
      "Add a png, jpeg, webp or gif image.",
    );
    await expect(
      commands["add-thread-image"].run(ctx, { threadId: id, path: "downloads/1.png", commentId: "c9" }),
    ).rejects.toThrow("The snapshot has no comment c9.");
    const huge = new Uint8Array(5_000_001);
    huge.set(png);
    await workspace.writeBytes("downloads/huge.png", huge);
    await expect(commands["add-thread-image"].run(ctx, { threadId: id, path: "downloads/huge.png" })).rejects.toThrow(
      "Keep images under 5 MB.",
    );
    for (const name of ["1.png", "2.png", "3.png", "4.png"])
      await commands["add-thread-image"].run(ctx, { threadId: id, path: `downloads/${name}` });
    await expect(commands["add-thread-image"].run(ctx, { threadId: id, path: "downloads/5.png" })).rejects.toThrow(
      "A thread keeps at most 4 images.",
    );
  });

  test("a new thread cannot name images before they are added", async () => {
    const { ctx } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const input = foundThread(run.runId);
    const snapshot = { ...input.snapshot, post: { ...input.snapshot.post, images: [{ file: "shot.png" }] } };
    await expect(commands["save-thread"].run(ctx, { input: { ...input, snapshot } })).rejects.toThrow(
      "Add shot.png with add-thread-image first.",
    );
  });

  test("a refreshed snapshot keeps the images it names and deletes the rest", async () => {
    const { ctx, id, read, threadMedia, workspace } = await savedThread();
    for (const name of ["keep.png", "drop.png"]) await workspace.writeBytes(`downloads/${name}`, png);
    for (const name of ["keep.png", "drop.png"])
      await commands["add-thread-image"].run(ctx, { threadId: id, path: `downloads/${name}` });
    const snapshot = (await read()).snapshot;
    if (!snapshot) throw new Error("Missing snapshot");
    const refreshed = { ...snapshot, post: { ...snapshot.post, images: [{ file: "keep.png" }] } };
    await commands["update-thread"].run(ctx, { id, input: { snapshot: refreshed } });
    expect((await threadMedia.list(`${id}/*`)).map((file) => file.path)).toEqual([`${id}/keep.png`]);
    const missing = { ...snapshot, post: { ...snapshot.post, images: [{ file: "never-added.png" }] } };
    await expect(commands["update-thread"].run(ctx, { id, input: { snapshot: missing } })).rejects.toThrow(
      "Add never-added.png with add-thread-image first.",
    );
  });
});
