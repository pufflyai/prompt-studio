import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { defineCommand, type ExtensionContextBase, l10n, params } from "@pstdio/sdk/extensions";
import { diagnosticsChanged } from "./events";
import { captureFiles, diagnosticDirectory, missingCapture } from "./files";
import { captureProfile } from "./profile";
import { diagnosticRuntime } from "./state";
import { type DiagnosticKind, type DiagnosticRecord, type DiagnosticView, diagnosticRunning } from "./types";

type Context = Pick<ExtensionContextBase, "projectId" | "automation" | "events">;
const filesOf = (ctx: Pick<Context, "projectId">, directory = diagnosticDirectory()) => {
  if (!ctx.projectId) throw new Error("Backend diagnostics need a project.");
  return captureFiles(directory, ctx.projectId);
};
const changed = (ctx: Context) => ctx.events.emit(diagnosticsChanged, {});

export const readDiagnostic = async (ctx: Context, id: string, directory = diagnosticDirectory()) => {
  const files = filesOf(ctx, directory);
  let record = await files.read(id);
  const run = record.automationId ? await ctx.automation.get(record.automationId) : undefined;
  if (run?.finishedAt && !record.finishedAt) record = await files.update(id, { finishedAt: run.finishedAt });
  const hasResult = await files.hasResult(id);
  let status: DiagnosticView["status"] = hasResult ? "succeeded" : "unavailable";
  if (record.admissionError && !hasResult) status = "failed";
  if (diagnosticRuntime.active === id) status = "running";
  if (run) status = run.status;
  return {
    ...record,
    status,
    error: run?.error?.message ?? record.admissionError ?? null,
    hasResult,
  } satisfies DiagnosticView;
};

const listDiagnostics = async (ctx: Context, directory: string) => {
  const files = filesOf(ctx, directory);
  const results = await Promise.all(
    (await files.list()).map((record) =>
      readDiagnostic(ctx, record.id, directory).catch((error: unknown) => {
        if (!missingCapture(error)) throw error;
        return undefined;
      }),
    ),
  );
  const captures = results.filter((capture) => capture !== undefined);
  await files.prune(captures.filter((capture) => !diagnosticRunning(capture)).map((capture) => capture.id));
  const retained = new Set((await files.list()).map((record) => record.id));
  return captures.filter((capture) => retained.has(capture.id));
};

export const createDiagnosticCommands = (directory = diagnosticDirectory()) => {
  const worker = defineCommand({
    id: "diagnostics.capture",
    title: l10n("diagnostics.commands.capture", "Collect backend diagnostic evidence"),
    automation: true,
    params: { id: params.text({ required: true }) },
    async run(ctx, { id }) {
      const files = filesOf(ctx, directory);
      const record = await files.read(id);
      try {
        await files.update(id, {
          startedAt: new Date().toISOString(),
          pid: process.pid,
          hostname: hostname(),
          admissionError: undefined,
        });
        await changed(ctx);
        const result = await captureProfile({
          id,
          kind: record.kind,
          durationMs: record.seconds * 1000,
          signal: ctx.signal,
        });
        ctx.signal?.throwIfAborted();
        await files.writeResult(id, result.data);
        await files.update(id, { summary: result.summary });
        return { captureId: id, pid: process.pid, summary: result.summary };
      } finally {
        await files.update(id, { finishedAt: new Date().toISOString() });
        await files.prune();
        await changed(ctx);
      }
    },
  });

  const captureId = { id: params.text({ label: l10n("diagnostics.params.id", "Capture ID"), required: true }) };

  return {
    "diagnostics.start": defineCommand({
      id: "diagnostics.start",
      title: l10n("diagnostics.commands.start", "Start a backend diagnostic capture"),
      cli: true,
      params: {
        kind: params.select({
          label: l10n("diagnostics.params.kind", "Evidence"),
          description: l10n("diagnostics.params.kindDescription", "cpu: CPU profile; coverage: function calls"),
          options: [
            { label: "cpu", value: "cpu" },
            { label: "coverage", value: "coverage" },
          ],
        }),
        seconds: params.number({ label: l10n("diagnostics.params.seconds", "Seconds (1–60; default 15)") }),
      },
      async run(ctx, { kind = "cpu", seconds = 15 }) {
        if (kind !== "cpu" && kind !== "coverage") throw new Error("Evidence must be cpu or coverage.");
        if (!Number.isInteger(seconds) || seconds < 1 || seconds > 60)
          throw new Error("Capture duration must be an integer from 1 to 60 seconds.");
        const files = filesOf(ctx, directory);
        await listDiagnostics(ctx, directory);
        const record: DiagnosticRecord = {
          id: randomUUID(),
          projectId: ctx.projectId!,
          kind: kind as DiagnosticKind,
          seconds,
          createdAt: new Date().toISOString(),
        };
        await files.create(record);
        const run = await ctx.automation
          .enqueue({
            command: worker.ref,
            input: { params: { id: record.id } },
            key: `diagnostic:${record.id}`,
          })
          .catch(async (error: unknown) => {
            await files.update(record.id, {
              finishedAt: new Date().toISOString(),
              admissionError: error instanceof Error ? error.message : String(error),
            });
            await files.prune();
            await changed(ctx);
            throw error;
          });
        try {
          await files.update(record.id, { automationId: run.id });
        } catch (error) {
          await ctx.automation.cancel(run.id);
          throw error;
        }
        await changed(ctx);
        return readDiagnostic(ctx, record.id, directory);
      },
    }),
    "diagnostics.list": defineCommand({
      id: "diagnostics.list",
      title: l10n("diagnostics.commands.list", "List backend diagnostic captures"),
      cli: true,
      async run(ctx) {
        return listDiagnostics(ctx, directory);
      },
    }),
    "diagnostics.read": defineCommand({
      id: "diagnostics.read",
      title: l10n("diagnostics.commands.read", "Read backend diagnostic status and summary"),
      cli: true,
      params: captureId,
      run: (ctx, { id }) => readDiagnostic(ctx, id, directory),
    }),
    "diagnostics.cancel": defineCommand({
      id: "diagnostics.cancel",
      title: l10n("diagnostics.commands.cancel", "Cancel a backend diagnostic capture"),
      cli: true,
      params: captureId,
      async run(ctx, { id }) {
        const record = await filesOf(ctx, directory).read(id);
        if (!record.automationId) throw new Error("The diagnostic capture has not been queued yet.");
        const run = await ctx.automation.cancel(record.automationId);
        await filesOf(ctx, directory).update(id, { finishedAt: run.finishedAt ?? new Date().toISOString() });
        await changed(ctx);
        return readDiagnostic(ctx, id, directory);
      },
    }),
    "diagnostics.export": defineCommand({
      id: "diagnostics.export",
      title: l10n("diagnostics.commands.export", "Export backend diagnostic evidence as JSON"),
      cli: true,
      params: captureId,
      async run(ctx, { id }) {
        return { capture: await readDiagnostic(ctx, id, directory), data: await filesOf(ctx, directory).result(id) };
      },
    }),
    "diagnostics.capture": worker,
  };
};

export const diagnosticCommands = createDiagnosticCommands();
