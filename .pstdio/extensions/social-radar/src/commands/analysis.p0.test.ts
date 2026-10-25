import { describe, expect, test } from "bun:test";
import type { Thread } from "../schemas";
import { commands } from ".";
import { foundThread, setup } from "./test-context";

const analysis = (sentiment: "positive" | "negative", topics: string[]) => ({
  summary: "People compare tools.",
  sentiment,
  replySentiment: { negative: 0, neutral: 1, positive: 2 },
  topics: topics.map((label) => ({ label, count: 1 })),
  questions: [],
});

describe("social radar analysis", () => {
  test("counts mentions, sentiment, sites, topics and replies from saved tags", async () => {
    const { ctx, storage } = setup();
    const run = await commands["run-daily"].run(ctx, {});
    const mention = await commands["save-thread"].run(ctx, {
      input: { ...foundThread(run.runId), mention: true, analysis: analysis("positive", ["review flow", "pricing"]) },
    });
    await commands["save-thread"].run(ctx, {
      input: {
        ...foundThread(run.runId, "https://reddit.com/r/ClaudeAI/comments/1"),
        site: "reddit",
        mention: true,
        analysis: analysis("negative", ["review flow"]),
      },
    });
    await commands["set-thread-status"].run(ctx, { id: mention.id, status: "answered" });
    const threads = storage.collection<Thread>("threads");
    const answered = await threads.get(mention.id);
    if (!answered || !("snapshot" in answered) || !answered.snapshot) throw new Error("Missing snapshot");
    await threads.update(mention.id, {
      ...answered,
      snapshot: {
        ...answered.snapshot,
        comments: [
          { id: "mine", author: "me", body: "Try this.", mine: true },
          { id: "reply", parentId: "mine", author: "dana", body: "Thanks!" },
        ],
      },
    });
    const result = await commands["list-analysis"].run(ctx, {});
    expect(result).toMatchObject({
      mentions: { count: 2, change: 2 },
      threadsFound: 2,
      answered: { count: 1, gotReply: 1 },
      mentionSentiment: { positive: 1, negative: 1, neutral: 0 },
      mentionsBySite: [
        { site: "hn", count: 1 },
        { site: "reddit", count: 1 },
      ],
      topics: [
        { label: "review flow", count: 2 },
        { label: "pricing", count: 1 },
      ],
    });
    expect(result.mentionsPerDay).toHaveLength(14);
    expect(result.mentionsPerDay.at(-1)?.count).toBe(2);
    expect((await commands["list-analysis"].run(ctx, { site: "reddit" })).mentions.count).toBe(1);
  });
});
