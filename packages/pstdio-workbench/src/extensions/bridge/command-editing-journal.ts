import {
  applyEditingChanges,
  diffEditingState,
  type JsonObject,
  rebaseEditingChanges,
  type WebviewEditingChange,
  type WebviewEditingCommandResult,
  type WebviewEditingSessionParams,
  type WebviewEditingSnapshot,
} from "pstdio-api-contracts/extension-kernel";
import { type CommandEditingMember, type CommandEditingOpen, editingFailure } from "./command-editing-types";
import { type CommandEditingJob, createCommandEditingWriter } from "./command-editing-writer";
import { editingSequence } from "./editing-sequence";
import { webviewEditingResultSchema } from "./webview-editing-params";

/** This is the ordered domain protocol. Query caches only contain accepted finite results. */
export const createCommandEditingJournal = (input: {
  command: CommandEditingOpen["command"];
  serialize: <T>(run: () => Promise<T>, signal?: AbortSignal) => Promise<T>;
  accepted(result: WebviewEditingCommandResult): void;
  changed(accepted?: { member: CommandEditingMember; sequence: number }): void;
}) => {
  let baseline: JsonObject = {};
  let version = 0;
  let revision = 0;
  let savedRevision = 0;
  let previews = new Map<CommandEditingMember, WebviewEditingChange[]>();
  let error: WebviewEditingSnapshot["error"];
  const validate = (result: WebviewEditingCommandResult) => {
    if (result.value === undefined) applyEditingChanges(baseline, result.changes);
    return result;
  };
  const writer = createCommandEditingWriter({
    run: (job, accepted) =>
      input.serialize(async () => {
        const result = webviewEditingResultSchema.parse(
          await job.execute({ commandId: input.command.commandId, params: job.params }),
        );
        // A JSON-valid patch can still be inapplicable. Keep its required job until acceptance is valid.
        validate(result);
        accepted(result);
      }),
    accepted: (job, result) => {
      savedRevision = job.revision;
      error = undefined;
      input.accepted(result);
      accept(result);
    },
    failed: (cause, job) => {
      error = { message: cause instanceof Error ? cause.message : String(cause), channel: job.channel };
    },
    changed: () => publish(),
  });
  const jobs = writer.jobs;
  const committed = () => rebaseEditingChanges(baseline, new Map(jobs.map((job) => [job, job.changes]))).value;
  const snapshot = () =>
    ({
      value: rebaseEditingChanges(committed(), previews).value,
      version,
      revision,
      savedRevision,
      hasDrafts: previews.size > 0,
      pendingCommands: jobs.length,
      ...(error ? { error } : {}),
    }) satisfies WebviewEditingSnapshot;
  const publish = (accepted?: { member: CommandEditingMember; sequence: number }) => {
    version++;
    input.changed(accepted);
  };
  const accept = (result: WebviewEditingCommandResult) => {
    baseline =
      result.value !== undefined ? structuredClone(result.value) : applyEditingChanges(baseline, result.changes);
    const rebased = rebaseEditingChanges(baseline, new Map(jobs.map((job) => [job, job.changes])));
    for (const job of jobs) job.changes = rebased.drafts.get(job) ?? [];
    previews = rebaseEditingChanges(rebased.value, previews).drafts;
    publish();
  };
  return {
    snapshot,
    validate,
    accept,
    flush: writer.flush,
    touch: () => publish(),
    active: () => writer.active() || previews.size > 0,
    requiredFor: (workbench: CommandEditingMember["workbench"]) => jobs.some((job) => job.workbench === workbench),
    preview(
      member: CommandEditingMember,
      request: Extract<WebviewEditingSessionParams, { operation: "commit" | "preview" }>,
    ) {
      if (!editingSequence(member).preview(request.sequence)) return;
      const value = committed();
      const draft = applyEditingChanges(value, previews.get(member) ?? []);
      const changes = diffEditingState(value, applyEditingChanges(draft, request.changes));
      const next = new Map(previews);
      next.delete(member);
      if (changes.length) next.set(member, changes);
      applyEditingChanges(value, [...next.values()].flat());
      previews = next;
      publish({ member, sequence: request.sequence });
    },
    execute(member: CommandEditingMember, request: Extract<WebviewEditingSessionParams, { operation: "execute" }>) {
      if (jobs.length >= 128) throw editingFailure("editing_command_queue_full");
      const ownPreview = editingSequence(member).complete(request.sequence);
      const changes = structuredClone([...(ownPreview ? (previews.get(member) ?? []) : []), ...request.changes]);
      applyEditingChanges(committed(), changes);
      const params = structuredClone({ ...input.command.params, ...request.params, operationId: crypto.randomUUID() });
      if (ownPreview) previews.delete(member);
      const job: CommandEditingJob = {
        params,
        changes,
        revision: ++revision,
        execute: member.execute,
        workbench: member.workbench,
        channel: request.channel,
      };
      jobs.push(job);
      error = undefined;
      previews = rebaseEditingChanges(committed(), previews).drafts;
      publish({ member, sequence: request.sequence });
      return writer.wait([job]);
    },
    cancel(member: CommandEditingMember, sequence?: number) {
      if (!editingSequence(member).cancel(sequence)) return;
      if (previews.delete(member)) publish();
    },
    clear() {
      baseline = {};
      previews.clear();
    },
  };
};
