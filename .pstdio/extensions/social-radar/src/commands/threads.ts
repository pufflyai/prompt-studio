import { defineCommand, params } from "@pstdio/sdk/extensions";
import { requireRunning } from "../run-lifecycle";
import { isNewPost, type NewPost, saveThread, type Thread, threadStatus, updateThread } from "../schemas";
import { mediaRules } from "../sites";
import { changed, ideasOf, requireThread, threadsOf } from "../store";
import { canonicalThreadUrl, threadId } from "../urls";

const foundOnly = ["mention", "author", "community", "excerpt", "publishedAt", "topic", "intent", "relevance"];
const postOnly = ["draft", "tags", "basedOn"];

export const saveThreadCommand = defineCommand({
  id: "save-thread",
  title: "Save a thread or new post",
  cli: true,
  params: { input: params.json({ required: true }) },
  async run(ctx, { input }) {
    const data = saveThread.parse(input);
    await requireRunning(ctx, data.runId);
    const foundAt = new Date().toISOString();
    if ("kind" in data) {
      const id = crypto.randomUUID();
      await threadsOf(ctx).put(id, { ...data, id, status: "idea", foundAt });
      await changed(ctx, id);
      return { id, created: true };
    }
    const url = canonicalThreadUrl(data.url);
    // A published new post keeps its own id, so a search that finds it again must not save it twice.
    const posted = (await threadsOf(ctx).list()).find((thread) => isNewPost(thread) && thread.url === url);
    if (posted) return { id: posted.id, created: false };
    const id = threadId(url);
    const created = await threadsOf(ctx).createIfAbsent(id, { ...data, url, id, status: "new", foundAt });
    if (created) await changed(ctx, id);
    return { id, created };
  },
});

export const updateThreadCommand = defineCommand({
  id: "update-thread",
  title: "Revise a thread",
  cli: true,
  params: { id: params.text({ required: true }), input: params.json({ required: true }) },
  async run(ctx, { id, input }) {
    const patch = updateThread.parse(input);
    const thread = await requireThread(ctx, id);
    const foreign = isNewPost(thread) ? foundOnly : postOnly;
    const wrong = Object.keys(patch).filter((key) => foreign.includes(key));
    if (wrong.length) throw new Error(`This thread has no ${wrong.join(", ")} field.`);
    if (patch.outcome && thread.status !== "answered") throw new Error("Only an answered thread has an outcome.");
    if (patch.snapshot) {
      // Reply ideas point at snapshot comments, so a refreshed snapshot must keep those comments.
      const kept = new Set(patch.snapshot.comments.map((comment) => comment.id));
      const ideas = await ideasOf(ctx).list();
      const lost = ideas.find(
        (idea) => idea.threadId === id && idea.replyTo && idea.status !== "dismissed" && !kept.has(idea.replyTo),
      );
      if (lost) throw new Error(`Keep comment ${lost.replyTo} in the snapshot; a reply idea answers it.`);
    }
    const outcomeCheckedAt = patch.outcome ? new Date().toISOString() : thread.outcomeCheckedAt;
    await threadsOf(ctx).update(id, { ...thread, ...patch, outcomeCheckedAt } as Thread);
    await changed(ctx, id);
    return { id };
  },
});

export const setThreadStatus = defineCommand({
  id: "set-thread-status",
  title: "Update thread status",
  cli: true,
  params: {
    id: params.text({ required: true }),
    status: params.text({ required: true }),
    url: params.text({ description: "The posted link. Required to mark a new post answered." }),
  },
  async run(ctx, { id, status, url }) {
    const value = threadStatus.parse(status);
    const thread = await requireThread(ctx, id);
    if (thread.status === "answered") {
      if (value === "answered") return { id };
      throw new Error("Answered threads cannot move back.");
    }
    if (value === "idea" && !isNewPost(thread)) throw new Error("Only a new post is an idea.");
    if (value === "new" && isNewPost(thread)) throw new Error("A new post is an idea, not a found thread.");
    if (value !== "answered") {
      await threadsOf(ctx).update(id, { ...thread, status: value });
      await changed(ctx, id);
      return { id };
    }
    const answeredAt = new Date().toISOString();
    if (!isNewPost(thread)) {
      await threadsOf(ctx).update(id, { ...thread, status: value, answeredAt });
      await changed(ctx, id);
      return { id };
    }
    if (!url) throw new Error("Paste the link of the post you published.");
    const link = canonicalThreadUrl(url);
    if ((await threadsOf(ctx).list()).some((saved) => saved.url === link))
      throw new Error("This link is already saved as a thread.");
    const posted: NewPost = { ...thread, status: value, answeredAt, url: link };
    await threadsOf(ctx).update(id, posted);
    await changed(ctx, id);
    return { id };
  },
});

export const recordOutcome = defineCommand({
  id: "record-outcome",
  title: "Record an answered thread outcome",
  cli: true,
  params: { threadId: params.text({ required: true }), outcome: params.longText({ required: true }) },
  async run(ctx, input) {
    const thread = await requireThread(ctx, input.threadId);
    if (thread.status !== "answered") throw new Error("Only an answered thread has an outcome.");
    if (!input.outcome.trim()) throw new Error("Write an outcome note.");
    await threadsOf(ctx).update(thread.id, {
      ...thread,
      outcome: input.outcome.trim(),
      outcomeCheckedAt: new Date().toISOString(),
    });
    await changed(ctx, thread.id);
    return { id: thread.id };
  },
});

export const getThread = defineCommand({
  id: "get-thread",
  title: "Read a thread with its reply ideas",
  cli: true,
  params: { id: params.text({ required: true }) },
  async run(ctx, { id }) {
    const thread = await requireThread(ctx, id);
    const ideas = (await ideasOf(ctx).list()).filter((idea) => idea.threadId === id);
    ideas.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // basedOn mixes thread ids with commit SHAs and changeset names; only saved threads have titles.
    const sourceTitles: Record<string, string> = {};
    for (const source of isNewPost(thread) ? (thread.basedOn ?? []) : []) {
      const found = await threadsOf(ctx).get(source);
      if (found) sourceTitles[source] = found.title;
    }
    return { thread, ideas, sourceTitles, mediaRule: mediaRules[thread.site] };
  },
});
