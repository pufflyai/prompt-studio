import { defineCommand, params } from "@pstdio/sdk/extensions";
import { requireRunning } from "../run-lifecycle";
import { ideaStatus, isNewPost, saveIdea, updateIdea } from "../schemas";
import { changed, ideasOf, requireThread } from "../store";

const requireIdea = async (ctx: Parameters<typeof ideasOf>[0], id: string) => {
  const idea = await ideasOf(ctx).get(id);
  if (!idea) throw new Error("Reply idea not found.");
  return idea;
};

export const saveIdeaCommand = defineCommand({
  id: "save-idea",
  title: "Save a reply idea",
  cli: true,
  params: { input: params.json({ required: true }) },
  async run(ctx, { input }) {
    const data = saveIdea.parse(input);
    await requireRunning(ctx, data.runId);
    const thread = await requireThread(ctx, data.threadId);
    if (isNewPost(thread)) throw new Error("A new post has no reply ideas; revise its draft instead.");
    if (data.replyTo && !thread.snapshot?.comments.some((comment) => comment.id === data.replyTo))
      throw new Error("replyTo must name a comment in the thread's snapshot.");
    const id = crypto.randomUUID();
    await ideasOf(ctx).put(id, { ...data, id, status: "new", createdAt: new Date().toISOString() });
    await changed(ctx, thread.id);
    return { id };
  },
});

export const updateIdeaCommand = defineCommand({
  id: "update-idea",
  title: "Revise a reply idea",
  cli: true,
  params: { id: params.text({ required: true }), input: params.json({ required: true }) },
  async run(ctx, { id, input }) {
    const patch = updateIdea.parse(input);
    const idea = await requireIdea(ctx, id);
    await ideasOf(ctx).update(id, { ...idea, ...patch });
    await changed(ctx, idea.threadId);
    return { id };
  },
});

export const setIdeaStatus = defineCommand({
  id: "set-idea-status",
  title: "Update reply idea status",
  cli: true,
  params: { id: params.text({ required: true }), status: params.text({ required: true }) },
  async run(ctx, { id, status }) {
    const value = ideaStatus.parse(status);
    const idea = await requireIdea(ctx, id);
    await ideasOf(ctx).update(id, { ...idea, status: value });
    await changed(ctx, idea.threadId);
    return { id };
  },
});
