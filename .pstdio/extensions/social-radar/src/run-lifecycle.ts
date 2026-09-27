import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import type { z } from "zod";
import { finishRun, type Idea, type Run, type Thread } from "./schemas";
import { readSettings } from "./settings";

const activeStatuses = new Set(["queued", "in_progress", "awaiting_input"]);
const pending = new Map<string, Promise<unknown>>();
// Commands and session hooks share one queue per project so a click and schedule cannot start two sessions.
export const serializeRun = async <T>(ctx: ExtensionContextBase, operation: () => Promise<T>) => {
  const previous = pending.get(ctx.projectId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  pending.set(ctx.projectId, next);
  try {
    return await next;
  } finally {
    if (pending.get(ctx.projectId) === next) pending.delete(ctx.projectId);
  }
};
export const requireRun = async (ctx: ExtensionContextBase, id: string) => {
  const run = await ctx.storage.collection<Run>("runs").get(id);
  if (!run) throw new Error("Run not found.");
  return run;
};
export const requireRunning = async (ctx: ExtensionContextBase, id: string) => {
  const run = await requireRun(ctx, id);
  if (run.status !== "running") throw new Error("Run has ended.");
  return run;
};
const notify = (ctx: ExtensionContextBase, run: Run, title: string) =>
  ctx.notify.action({
    title,
    body: run.summary ?? run.failureReason,
    kind: run.status === "failed" ? "failed" : "info",
    dedupeKey: `social-radar:${run.id}`,
    actions: [
      {
        id: "open-digest",
        label: "Open digest",
        kind: "navigate",
        primary: true,
        target: { kind: "page", page: { kind: "page", id: "pstdio.social-radar.page.digest" } },
      },
    ],
  });
const failRun = async (ctx: ExtensionContextBase, run: Run, reason: string) => {
  const failed = { ...run, status: "failed" as const, failureReason: reason, finishedAt: new Date().toISOString() };
  await ctx.storage.collection<Run>("runs").update(run.id, failed);
  await notify(ctx, failed, "Social radar run failed");
};
export const startRun = (ctx: ExtensionContextBase) =>
  serializeRun(ctx, async () => {
    const runs = ctx.storage.collection<Run>("runs");
    for (const run of await runs.list()) {
      if (run.status !== "running") continue;
      const session = run.sessionId ? await ctx.sessions.get(run.sessionId) : null;
      if (session?.status && activeStatuses.has(session.status))
        return { runId: run.id, alreadyRunning: true as const };
      await failRun(ctx, run, "session ended without finish-run");
    }
    await readSettings(ctx.settings);
    const now = new Date();
    const run: Run = { id: crypto.randomUUID(), status: "running", sessionId: "", startedAt: now.toISOString() };
    await runs.put(run.id, run);
    try {
      const session = await ctx.sessions.create({
        title: `Social radar ${now.toLocaleDateString("sv-SE")}`,
        prompt: `Use the social-radar skill. Run id: ${run.id}. Start with pst social-radar get-context --runId ${run.id}. Save results through social-radar commands. Finish with pst social-radar finish-run. Read only: never post, reply, like, follow, or send messages.`,
        harness: { harnessId: "pstdio.harness-codex.harness.codex", model: "gpt-6-astra" },
      });
      await runs.update(run.id, { ...run, sessionId: session.id });
      return { runId: run.id, sessionId: session.id };
    } catch (error) {
      await failRun(ctx, run, error instanceof Error ? error.message : String(error));
      throw error;
    }
  });
export const completeRun = (ctx: ExtensionContextBase, input: unknown) =>
  serializeRun(ctx, async () => {
    const data: z.infer<typeof finishRun> = finishRun.parse(input);
    const run = await requireRun(ctx, data.runId);
    if (run.status === "done") return { runId: run.id };
    if (run.status !== "running") throw new Error("Run has ended.");
    const settings = await readSettings(ctx.settings);
    for (const [site, count] of Object.entries(data.searches)) {
      if (count > settings.budgets[site as keyof typeof settings.budgets])
        throw new Error(`Search budget exceeded for ${site}.`);
    }
    const done: Run = { ...run, ...data, status: "done", finishedAt: new Date().toISOString() };
    const threads = (await ctx.storage.collection<Thread>("threads").list()).filter((item) => item.runId === run.id);
    const ideas = (await ctx.storage.collection<Idea>("ideas").list()).filter((item) => item.runId === run.id);
    await notify(ctx, done, `Social radar: ${threads.length} threads, ${ideas.length} ideas`);
    await ctx.storage.collection<Run>("runs").update(run.id, done);
    return { runId: run.id };
  });
export const sessionFailed = (ctx: ExtensionContextBase, sessionId: string) =>
  serializeRun(ctx, async () => {
    for (const run of await ctx.storage.collection<Run>("runs").list()) {
      if (run.status === "running" && run.sessionId === sessionId) await failRun(ctx, run, "Research session failed.");
    }
  });
