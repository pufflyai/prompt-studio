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
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import type { OperationFailure } from "../../core/registries/mutations/operation-types";
import { type CommandEditingMember, type CommandEditingOpen, editingFailure } from "./command-editing-types";
import { type CommandEditingJob, createCommandEditingWriter } from "./command-editing-writer";
import { editingSequence } from "./editing-sequence";
import { webviewEditingResultSchema } from "./webview-editing-params";

class EditingAcknowledgementError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}

const mayRetryEditingCommand = (error: unknown) =>
  !(error instanceof EditingAcknowledgementError) && classifyApiWrite(error) === "rejected";

export type TrackEditingCommand = (
  job: CommandEditingJob,
  queued: readonly CommandEditingJob[],
  write: (signal?: AbortSignal) => Promise<WebviewEditingCommandResult>,
  accept: (result: WebviewEditingCommandResult) => void,
  classify: (error: unknown) => OperationFailure,
) => Promise<void>;

/** This is the ordered domain protocol. Query caches only contain accepted finite results. */
export const createCommandEditingJournal = (input: {
  command: CommandEditingOpen["command"];
  serialize: <T>(run: () => Promise<T>, signal?: AbortSignal) => Promise<T>;
  accepted(result: WebviewEditingCommandResult): void;
  changed(accepted?: { member: CommandEditingMember; sequence: number }): void;
  track?: TrackEditingCommand;
}) => {
  let baseline: JsonObject = {};
  let version = 0;
  let revision = 0;
  let savedRevision = 0;
  let previews = new Map<CommandEditingMember, WebviewEditingChange[]>();
  let retainedFormDraft: CommandEditingMember | undefined;
  let error: WebviewEditingSnapshot["error"];
  const validate = (result: WebviewEditingCommandResult) => {
    if (result.value === undefined) applyEditingChanges(baseline, result.changes);
    return result;
  };
  const writer = createCommandEditingWriter({
    run: (job, accepted) =>
      input.serialize(async () => {
        const write = async (signal?: AbortSignal) => {
          const response = await job.execute({ commandId: input.command.commandId, params: job.params }, signal);
          signal?.throwIfAborted();
          try {
            return validate(webviewEditingResultSchema.parse(response));
          } catch (error) {
            // The command may have committed before sending an unusable acknowledgement.
            throw new EditingAcknowledgementError(error);
          }
        };
        if (input.track) {
          return input.track(job, writer.jobs, write, accepted, (error) =>
            mayRetryEditingCommand(error) ? "rejected" : "unknown",
          );
        }
        accepted(await write());
      }),
    accepted: (job, result) => {
      savedRevision = job.revision;
      error = undefined;
      input.accepted(result);
      accept(result);
    },
    canRetry: mayRetryEditingCommand,
    failed: (cause, job) => {
      const message = cause instanceof Error ? cause.message : String(cause);
      error = {
        message: writer.blocked() ? `The command result could not be confirmed. ${message}` : message,
        channel: job.channel,
      };
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
  const execute = (
    member: CommandEditingMember,
    request: Extract<WebviewEditingSessionParams, { operation: "execute" }>,
  ) => {
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
    if (!writer.blocked()) error = undefined;
    previews = rebaseEditingChanges(committed(), previews).drafts;
    publish({ member, sequence: request.sequence });
    return writer.wait([job]);
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
    execute,
    reopenFormDraft(member: CommandEditingMember) {
      if (!retainedFormDraft) return;
      const retained = previews.get(retainedFormDraft);
      previews.delete(retainedFormDraft);
      retainedFormDraft = undefined;
      if (retained) previews.set(member, retained);
    },
    retainFormDraft(member: CommandEditingMember) {
      const changes = previews.get(member);
      const field = (name: string) => changes?.find(({ path }) => path.length === 1 && path[0] === name)?.value;
      const draft = field("draft");
      const expectedRevision = field("draftBase") ?? baseline.revision;
      if (typeof draft !== "string" || typeof expectedRevision !== "string") return false;
      if (jobs.length >= 128) {
        if (retainedFormDraft) previews.delete(retainedFormDraft);
        retainedFormDraft = member;
        return true;
      }
      void execute(member, {
        operation: "execute",
        sessionId: member.id,
        sequence: 0,
        changes: [],
        params: { draft, expectedRevision },
        channel: "document",
      }).catch(() => {});
      return true;
    },
    cancel(member: CommandEditingMember, sequence?: number) {
      if (!editingSequence(member).cancel(sequence)) return;
      if (previews.delete(member)) publish();
    },
    clear() {
      baseline = {};
      retainedFormDraft = undefined;
      previews.clear();
    },
  };
};
