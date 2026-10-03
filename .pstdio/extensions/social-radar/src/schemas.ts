import { z } from "zod";

export const sites = ["hn", "reddit", "bluesky", "devto", "github", "youtube", "x", "linkedin"] as const;
export const siteSchema = z.enum(sites);
export type Site = z.infer<typeof siteSchema>;
export const sentiments = ["negative", "neutral", "positive"] as const;
export type Sentiment = (typeof sentiments)[number];
const text = z.string().trim().min(1);
const timestamp = z.iso.datetime();
// Found threads start as new and new posts as ideas; both end as answered or skipped.
export const threadStatus = z.enum(["new", "idea", "answered", "skipped"]);
export const ideaStatus = z.enum(["new", "saved", "used", "dismissed"]);
export const postKind = z.enum(["demo", "topic", "showcase"]);
const httpUrl = z.url({ protocol: /^https?$/ });

const snapshotComment = z.object({
  id: text,
  parentId: text.optional(),
  author: text,
  publishedAt: timestamp.optional(),
  body: text,
  votes: z.number().int().optional(),
  mine: z.boolean().optional(),
});
export const snapshotSchema = z.object({
  takenAt: timestamp,
  post: z.object({
    author: text.optional(),
    publishedAt: timestamp.optional(),
    body: text,
    score: z.number().int().optional(),
    commentCount: z.number().int().nonnegative().optional(),
  }),
  comments: z
    .array(snapshotComment)
    .max(30)
    .superRefine((comments, ctx) => {
      // Comments form a tree: unique ids, and no comment answers itself through its parents.
      const parents = new Map(comments.map((comment) => [comment.id, comment.parentId]));
      if (parents.size !== comments.length) ctx.addIssue({ code: "custom", message: "Comment ids must be unique." });
      for (const comment of comments) {
        const seen = new Set([comment.id]);
        for (let parent = comment.parentId; parent; parent = parents.get(parent)) {
          if (seen.has(parent)) {
            ctx.addIssue({ code: "custom", message: `Comment ${comment.id} answers itself.` });
            break;
          }
          seen.add(parent);
        }
      }
    }),
});
const count = z.number().int().nonnegative();
export const analysisSchema = z.object({
  summary: text,
  sentiment: z.enum(sentiments),
  replySentiment: z.object({ negative: count, neutral: count, positive: count }),
  topics: z.array(z.object({ label: text, count })),
  questions: z.array(text),
});
export const foundThreadInput = z.object({
  runId: text,
  site: siteSchema,
  url: httpUrl,
  title: text,
  author: text.optional(),
  community: text.optional(),
  excerpt: text.max(500),
  publishedAt: timestamp.optional(),
  topic: text,
  mention: z.boolean(),
  intent: z.enum(["asking-for-tool", "problem", "comparison", "launch", "mention", "discussion"]),
  relevance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reason: text,
  snapshot: snapshotSchema.optional(),
  analysis: analysisSchema.optional(),
});
export const newPostInput = z.object({
  runId: text,
  kind: postKind,
  site: siteSchema,
  title: text,
  draft: text,
  reason: text,
  tags: z.array(text),
  basedOn: z.array(text).optional(),
});
export const saveThread = z.union([newPostInput.strict(), foundThreadInput.strict()]);
// Run, site, URL and kind are the thread's identity; status changes go through set-thread-status.
export const updateThread = z
  .object({
    ...foundThreadInput.omit({ runId: true, site: true, url: true }).shape,
    ...newPostInput.omit({ runId: true, site: true, kind: true }).shape,
    outcome: text,
  })
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, "Provide at least one thread change.");
export const saveIdea = z.object({ runId: text, threadId: text, replyTo: text.optional(), body: text });
export const updateIdea = z.object({ body: text }).strict();
export const finishRun = z.object({
  runId: text,
  summary: text,
  searches: z.partialRecord(siteSchema, z.number().int().nonnegative()),
  skippedSites: z.array(z.object({ site: siteSchema, reason: text })),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type SnapshotComment = Snapshot["comments"][number];
export type Analysis = z.infer<typeof analysisSchema>;
export type FoundThreadInput = z.infer<typeof foundThreadInput>;
export type NewPostInput = z.infer<typeof newPostInput>;
interface ThreadState {
  id: string;
  status: z.infer<typeof threadStatus>;
  foundAt: string;
  answeredAt?: string;
  outcome?: string;
  outcomeCheckedAt?: string;
}
export type FoundThread = FoundThreadInput & ThreadState;
// After you publish a new post, follow-up runs snapshot and analyse it like a found thread.
export type NewPost = NewPostInput & ThreadState & { url?: string; snapshot?: Snapshot; analysis?: Analysis };
export type Thread = FoundThread | NewPost;
export const isNewPost = (thread: Thread): thread is NewPost => "kind" in thread;
export type SaveIdeaInput = z.infer<typeof saveIdea>;
export interface Idea extends SaveIdeaInput {
  id: string;
  status: z.infer<typeof ideaStatus>;
  createdAt: string;
}
export interface Run {
  id: string;
  status: "running" | "done" | "failed";
  sessionId: string;
  startedAt: string;
  finishedAt?: string;
  summary?: string;
  searches?: Partial<Record<Site, number>>;
  skippedSites?: { site: Site; reason: string }[];
  failureReason?: string;
}
