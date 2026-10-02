import { defineCommand, params } from "@pstdio/sdk/extensions";
import { mediaFits, mediaRules, mediaType } from "../sites";
import { changed, postMedia, requireThread } from "../store";

export const addMedia = defineCommand({
  id: "add-media",
  title: "Add media to a post",
  cli: true,
  params: {
    threadId: params.text({ required: true }),
    path: params.text({ required: true, description: "A file in the workspace, such as a screenshot." }),
  },
  async run(ctx, input) {
    const thread = await requireThread(ctx, input.threadId);
    const name = input.path.split("/").pop() ?? "";
    if (!mediaType(name)) throw new Error("Add a png, jpeg, webp, gif, mp4, mov or webm file.");
    const files = ctx.workspaceFiles ?? ctx.projectFiles;
    if (!files) throw new Error("This project has no workspace files to read.");
    const mount = ctx.artifacts.mount(postMedia.id);
    const existing = (await mount.list(`${thread.id}/*`)).map((file) => file.path);
    const path = `${thread.id}/${name}`;
    const next = existing.includes(path) ? existing : [...existing, path];
    if (!mediaFits(mediaRules[thread.site], next))
      throw new Error(`This file does not fit the media rule for ${thread.site}.`);
    await mount.writeBytes(path, await files.readBytes(input.path));
    await changed(ctx, thread.id);
    return { path };
  },
});
