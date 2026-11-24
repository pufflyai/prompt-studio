import { type ExtensionContextBase, eventRef, type StorageRecordIndex } from "@pstdio/sdk/extensions";
import type { FailureMode, Outcome, Remediation } from "./taxonomy";

export const extensionId = "pstdio.dev";
export const analysesChanged = eventRef<{ sessionIds: string[] }>({ extensionId, id: "insights.analyses-changed" });

export type Analysis = {
  kind: "analysis";
  sessionId: string;
  title: string;
  agent: string;
  model: string;
  status: string;
  exitCause: string;
  sessionCreatedAt: string;
  /** The session's updatedAt when it was scanned; a newer one means the analysis is stale. */
  sessionUpdatedAt: string;
  analyzedAt: string;
  userTurns: number;
  corrections: number;
  resumeNudges: number;
  toolCalls: number;
  toolFailures: number;
  toolDenied: number;
  outputTokens: number;
  durationMinutes: number;
  outcome: Outcome;
  /** Empty for successes and for failures nobody has classified yet. */
  failureMode: FailureMode | "";
  secondaryModes: FailureMode[];
  confidence: "low" | "medium" | "high";
  source: "heuristic" | "agent";
  needsReview: boolean;
  evidence: string;
  lesson: string;
  /** Lesson of an agent review that newer turns invalidated; kept until an agent classifies the session again. */
  earlierLesson?: string;
  remediation: Remediation | "";
  remediationTarget: string;
};

const indexedStrings = [
  "sessionId",
  "title",
  "agent",
  "model",
  "status",
  "sessionCreatedAt",
  "sessionUpdatedAt",
  "outcome",
  "failureMode",
  "confidence",
  "source",
  "evidence",
  "lesson",
  "remediation",
  "remediationTarget",
] as const;
const indexedNumbers = ["userTurns", "corrections", "toolCalls", "toolFailures", "durationMinutes"] as const;

export const analysisIndex: StorageRecordIndex = {
  name: "session-analyses",
  fields: {
    kind: { path: ["kind"], type: "string" },
    needsReview: { path: ["needsReview"], type: "boolean" },
    ...Object.fromEntries(indexedStrings.map((field) => [field, { path: [field], type: "string" as const }])),
    ...Object.fromEntries(indexedNumbers.map((field) => [field, { path: [field], type: "number" as const }])),
  },
  equality: ["kind"],
  orderBy: [{ field: "sessionCreatedAt", direction: "desc" }],
};

export type AnalysisRow = Pick<Analysis, (typeof indexedStrings)[number] | (typeof indexedNumbers)[number]> & {
  needsReview: boolean;
};

const storageOf = (ctx: ExtensionContextBase) => ctx.storage.scope({ type: "project" });
const recordKey = (sessionId: string) => `analysis:${sessionId}`;
const reviewerKey = (sessionId: string) => `reviewer:${sessionId}`;

const asObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

/** Reads every analysis summary through the index, one bounded page at a time. */
export const listAnalysisRows = async (ctx: ExtensionContextBase, signal?: AbortSignal) => {
  const records = storageOf(ctx).records;
  const rows: AnalysisRow[] = [];
  let cursor: string | undefined;
  do {
    signal?.throwIfAborted();
    const page = await records.query({
      index: analysisIndex.name,
      where: { field: "kind", op: "eq", value: "analysis" },
      fields: Object.keys(analysisIndex.fields),
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    for (const record of page.records) rows.push(record.fields as unknown as AnalysisRow);
    cursor = page.cursor ?? undefined;
  } while (cursor);
  return rows;
};

/** Reads stored analyses with the revision each was read at, so a later save can detect newer reviews. */
export const readAnalysisRecords = async (ctx: ExtensionContextBase, sessionIds: string[]) => {
  const storage = storageOf(ctx);
  const found = new Map<string, { analysis: Analysis; revision: string }>();
  for (let start = 0; start < sessionIds.length; start += 100) {
    const batch = sessionIds.slice(start, start + 100);
    const records = await storage.records.readMany(batch.map((id) => storage.records.id(recordKey(id))));
    records.forEach((record, index) => {
      const value = asObject(record.value);
      if (record.exists && !record.deleted && value?.kind === "analysis")
        found.set(batch[index]!, { analysis: value as Analysis, revision: record.revision });
    });
  }
  return found;
};

export const readAnalyses = async (ctx: ExtensionContextBase, sessionIds: string[]) =>
  new Map([...(await readAnalysisRecords(ctx, sessionIds))].map(([id, { analysis }]) => [id, analysis]));

export const readAnalysis = async (ctx: ExtensionContextBase, sessionId: string) =>
  (await readAnalyses(ctx, [sessionId])).get(sessionId);

export const saveAnalyses = async (ctx: ExtensionContextBase, analyses: Analysis[]) => {
  const storage = storageOf(ctx);
  for (let start = 0; start < analyses.length; start += 25) {
    const batch = analyses.slice(start, start + 25);
    await storage.records.commit({
      operationId: storage.ids.create(),
      edits: batch.map((analysis) => ({
        recordId: storage.records.id(recordKey(analysis.sessionId)),
        replace: analysis,
      })),
    });
  }
  if (analyses.length) await ctx.events.emit(analysesChanged, { sessionIds: analyses.map((a) => a.sessionId) });
};

/**
 * Saves scan results without overwriting a verdict that `insights.classify` saved after the scan read the record.
 * A record read earlier saves only if unchanged; a record that did not exist saves only if it still does not.
 * Skipped sessions keep their newer value and are read again by the next scan.
 */
export const saveScannedAnalyses = async (
  ctx: ExtensionContextBase,
  analyses: Analysis[],
  observed: ReadonlyMap<string, { revision: string }>,
) => {
  const storage = storageOf(ctx);
  const saved: Analysis[] = [];
  const created = analyses.filter((analysis) => !observed.has(analysis.sessionId));
  const stillMissing = created.length
    ? await readAnalysisRecords(
        ctx,
        created.map((a) => a.sessionId),
      )
    : new Map();
  for (const analysis of analyses) {
    const recordId = storage.records.id(recordKey(analysis.sessionId));
    const revision = observed.get(analysis.sessionId)?.revision;
    if (revision === undefined) {
      if (stillMissing.has(analysis.sessionId)) continue;
      await storage.records.commit({ operationId: storage.ids.create(), edits: [{ recordId, replace: analysis }] });
    } else {
      const outcome = await storage.records.commitIfCurrent({
        operationId: storage.ids.create(),
        edits: [{ recordId, replace: analysis, expectedRevision: revision }],
      });
      if (!outcome) continue;
    }
    saved.push(analysis);
  }
  if (saved.length) await ctx.events.emit(analysesChanged, { sessionIds: saved.map((a) => a.sessionId) });
  return saved.length;
};

/** Review sessions this extension started. Scans skip them so the reviewer does not grade itself. */
export const rememberReviewerSession = async (ctx: ExtensionContextBase, sessionId: string) => {
  const storage = storageOf(ctx);
  await storage.records.commit({
    operationId: storage.ids.create(),
    edits: [{ recordId: storage.records.id(reviewerKey(sessionId)), replace: { kind: "reviewer", sessionId } }],
  });
};

export const reviewerSessionIds = async (ctx: ExtensionContextBase, sessionIds: string[]) => {
  const storage = storageOf(ctx);
  const reviewers = new Set<string>();
  for (let start = 0; start < sessionIds.length; start += 100) {
    const batch = sessionIds.slice(start, start + 100);
    const records = await storage.records.readMany(batch.map((id) => storage.records.id(reviewerKey(id))));
    records.forEach((record, index) => {
      if (record.exists && !record.deleted) reviewers.add(batch[index]!);
    });
  }
  return reviewers;
};
