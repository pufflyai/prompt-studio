import { z } from "zod";

export const sites = ["hn", "reddit", "bluesky", "devto", "github", "youtube", "x", "linkedin"] as const;
export const siteSchema = z.enum(sites);
export type Site = z.infer<typeof siteSchema>;
const text = z.string().trim().min(1);
const timestamp = z.iso.datetime();
export const threadStatus = z.enum(["new", "saved", "posted", "skipped"]);
export const ideaStatus = z.enum(["new", "saved", "used", "dismissed"]);
export const saveThread = z.object({
  runId: text,
  site: siteSchema,
  url: z.url({ protocol: /^https?$/ }),
  title: text,
  author: text.optional(),
  community: text.optional(),
  excerpt: text.max(500),
  publishedAt: timestamp.optional(),
  topic: text,
  intent: z.enum(["asking-for-tool", "problem", "comparison", "launch", "mention", "discussion"]),
  relevance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reason: text,
  draftReply: text.optional(),
});
export const saveIdea = z.object({
  runId: text,
  kind: z.enum(["topic", "demo", "showcase", "reply"]),
  title: text,
  body: text,
  sites: z.array(siteSchema).min(1),
  tags: z.array(text),
  basedOn: z.array(text).optional(),
});
export const updateThread = saveThread
  .pick({
    title: true,
    excerpt: true,
    topic: true,
    intent: true,
    relevance: true,
    reason: true,
    community: true,
    draftReply: true,
  })
  .partial()
  .extend({
    community: z.string().trim().min(1).nullable().optional(),
    draftReply: z.string().trim().min(1).nullable().optional(),
    outcome: z.string().trim().min(1).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "Provide at least one thread change.");
export const updateIdea = saveIdea
  .omit({ runId: true })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "Provide at least one idea change.");
export const finishRun = z.object({
  runId: text,
  summary: text,
  searches: z.partialRecord(siteSchema, z.number().int().nonnegative()),
  skippedSites: z.array(z.object({ site: siteSchema, reason: text })),
});
export type SaveThreadInput = z.infer<typeof saveThread>;
export type SaveIdeaInput = z.infer<typeof saveIdea>;
export interface Thread extends SaveThreadInput {
  id: string;
  status: z.infer<typeof threadStatus>;
  foundAt: string;
  postedAt?: string;
  outcome?: string;
  outcomeCheckedAt?: string;
}
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
