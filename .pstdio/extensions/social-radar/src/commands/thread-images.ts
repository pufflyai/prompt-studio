import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import { type Snapshot, type SnapshotImage, snapshotSchema } from "../schemas";
import { changed, requireThread, threadMedia, threadsOf } from "../store";

const imageFile = /\.(png|jpe?g|webp|gif)$/i;
const maxImageBytes = 5_000_000;
// A blocked download often saves an HTML error page under the image's name, so the bytes must start like an image.
const imageSignatures = [
  [0x89, 0x50, 0x4e, 0x47],
  [0xff, 0xd8, 0xff],
  [0x47, 0x49, 0x46, 0x38],
  [0x52, 0x49, 0x46, 0x46],
];
const looksLikeImage = (bytes: Uint8Array) =>
  imageSignatures.some((signature) => signature.every((byte, index) => bytes[index] === byte)) &&
  (bytes[0] !== 0x52 || new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP");
const imagesOf = (snapshot: Snapshot) =>
  [snapshot.post, ...snapshot.comments].flatMap((part) => part.images ?? []).map((image) => image.file);

export const addThreadImage = defineCommand({
  id: "add-thread-image",
  title: "Keep a copy of a thread image",
  cli: true,
  params: {
    threadId: params.text({ required: true }),
    path: params.text({ required: true, description: "An image in the workspace, downloaded from the thread." }),
    commentId: params.text({ description: "The snapshot comment that shows the image. Leave it out for the post." }),
    alt: params.text({ description: "What the image shows." }),
  },
  async run(ctx, input) {
    const thread = await requireThread(ctx, input.threadId);
    if (!thread.snapshot) throw new Error("Save the thread's snapshot before its images.");
    const file = input.path.split("/").pop() ?? "";
    if (!imageFile.test(file)) throw new Error("Add a png, jpeg, webp or gif image.");
    const { post, comments } = thread.snapshot;
    if (input.commentId && !comments.some((comment) => comment.id === input.commentId))
      throw new Error(`The snapshot has no comment ${input.commentId}.`);
    const image: SnapshotImage = input.alt ? { file, alt: input.alt } : { file };
    const withImage = <Part extends { images?: SnapshotImage[] }>(part: Part) => ({
      ...part,
      images: [...(part.images ?? []), image],
    });
    const snapshot = snapshotSchema.parse({
      ...thread.snapshot,
      post: input.commentId ? post : withImage(post),
      comments: comments.map((comment) => (comment.id === input.commentId ? withImage(comment) : comment)),
    });
    const files = ctx.workspaceFiles ?? ctx.projectFiles;
    if (!files) throw new Error("This project has no workspace files to read.");
    const bytes = await files.readBytes(input.path);
    if (!looksLikeImage(bytes)) throw new Error(`${input.path} is not an image. Check the download.`);
    if (bytes.length > maxImageBytes) throw new Error("Keep images under 5 MB.");
    await ctx.artifacts.mount(threadMedia.id).writeBytes(`${thread.id}/${file}`, bytes);
    await threadsOf(ctx).update(thread.id, { ...thread, snapshot });
    await changed(ctx, thread.id);
    return { file };
  },
});

/** A refreshed snapshot names the images it keeps; it may not name copies that were never added. */
export const requireThreadImages = async (ctx: ExtensionContextBase, threadId: string, snapshot: Snapshot) => {
  const mount = ctx.artifacts.mount(threadMedia.id);
  for (const file of imagesOf(snapshot))
    if (!(await mount.exists(`${threadId}/${file}`))) throw new Error(`Add ${file} with add-thread-image first.`);
};

// The snapshot owns which copies a thread keeps, so copies it no longer names are deleted.
export const pruneThreadImages = async (ctx: ExtensionContextBase, threadId: string, snapshot: Snapshot) => {
  const mount = ctx.artifacts.mount(threadMedia.id);
  const kept = new Set(imagesOf(snapshot).map((file) => `${threadId}/${file}`));
  for (const file of await mount.list(`${threadId}/*`)) if (!kept.has(file.path)) await mount.delete(file.path);
};
