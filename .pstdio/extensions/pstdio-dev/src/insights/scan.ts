import { type CommandContext, defineCommand, type ExtensionSession, l10n, params } from "@pstdio/sdk/extensions";
import { buildAnalysis, isSyntheticAgent } from "./analyze";
import { type Analysis, listAnalysisRows, readAnalyses, reviewerSessionIds, saveAnalyses } from "./store";
import { outcomeIds } from "./taxonomy";

const active = new Set(["in_progress", "awaiting_input", "queued"]);

async function* projectSessions(ctx: CommandContext, since?: string) {
  let cursor: string | undefined;
  do {
    ctx.signal.throwIfAborted();
    const page = await ctx.sessions.query({
      includeArchived: true,
      orderBy: "created",
      limit: 200,
      ...(since ? { createdFrom: since } : {}),
      ...(cursor ? { cursor } : {}),
    });
    for (const session of page.items) yield session as ExtensionSession;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
}

/** Runs work over items with a small fixed number of conversations in flight. */
const mapPooled = async <T, R>(items: T[], width: number, work: (item: T) => Promise<R>) => {
  const results: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++]!;
        results.push(await work(item));
      }
    }),
  );
  return results;
};

export const scanSessions = defineCommand({
  id: "insights.scan",
  mutating: true,
  title: l10n("insights.commands.scan", "Scan sessions"),
  description:
    "Read new or changed sessions in this project and record a first-pass outcome. Agent verdicts on unchanged sessions are kept.",
  cli: { examples: ["pst pstdio.dev insights scan --limit 200", "pst pstdio.dev insights scan --since 2026-11-01"] },
  palette: [{ label: l10n("insights.commands.scan", "Scan sessions") }],
  params: {
    limit: params.number({ label: "Most sessions to read", defaultValue: 300 }),
    since: params.text({ label: "Only sessions created on or after (ISO date)" }),
    rescan: params.boolean({ label: "Re-read sessions that have not changed" }),
  },
  async run(ctx, input) {
    const limit = Math.max(1, input.limit ?? 300);
    const candidates: ExtensionSession[] = [];
    let skipped = 0;
    let pending: ExtensionSession[] = [];
    const flush = async () => {
      const reviewers = await reviewerSessionIds(
        ctx,
        pending.map((s) => s.id),
      );
      const existing = await readAnalyses(
        ctx,
        pending.map((s) => s.id),
      );
      for (const session of pending) {
        const previous = existing.get(session.id);
        if (reviewers.has(session.id)) continue;
        if (!input.rescan && previous?.sessionUpdatedAt === session.updatedAt) skipped++;
        else if (candidates.length < limit) candidates.push(session);
      }
      pending = [];
    };
    for await (const session of projectSessions(ctx, input.since)) {
      if (isSyntheticAgent(session.agent) || active.has(session.status)) continue;
      pending.push(session);
      if (pending.length === 100) await flush();
      if (candidates.length >= limit) break;
    }
    await flush();

    const previous = await readAnalyses(
      ctx,
      candidates.map((s) => s.id),
    );
    const failures: { sessionId: string; error: string }[] = [];
    let saved = 0;
    let batch: Analysis[] = [];
    await mapPooled(candidates, 4, async (session) => {
      ctx.signal.throwIfAborted();
      try {
        const conversation = await ctx.sessions.getConversation(session.id);
        batch.push(buildAnalysis(session, conversation, previous.get(session.id)));
      } catch (error) {
        failures.push({ sessionId: session.id, error: error instanceof Error ? error.message : String(error) });
      }
      if (batch.length >= 25) {
        const ready = batch;
        batch = [];
        await saveAnalyses(ctx, ready);
        saved += ready.length;
        ctx.logger.info(`Scanned ${saved} of ${candidates.length} sessions`);
      }
    });
    await saveAnalyses(ctx, batch);
    saved += batch.length;

    const rows = await listAnalysisRows(ctx, ctx.signal);
    const byOutcome = Object.fromEntries(outcomeIds.map((id) => [id, rows.filter((row) => row.outcome === id).length]));
    return {
      scanned: saved,
      unchanged: skipped,
      failed: failures.slice(0, 10),
      total: rows.length,
      needsReview: rows.filter((row) => row.needsReview).length,
      byOutcome,
    };
  },
});
