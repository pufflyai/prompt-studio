import type { ScopedQueryClient } from "@pstdio/sdk/extensions";
import type { WebviewEditingSessionParams, WebviewEditingSnapshot } from "pstdio-api-contracts/extension-kernel";
import { createCommandEditingJournal } from "./command-editing-journal";
import { createCommandEditingSources } from "./command-editing-sources";
import {
  type CommandEditingMember,
  type CommandEditingOpen,
  createEditingCommandQueue,
  type EditingExecutor,
  type EditingOwner,
  editingFailure,
} from "./command-editing-types";

export const createCommandEditingDocument = (input: {
  queries: ScopedQueryClient;
  owner: Pick<EditingOwner, "projectId" | "extensionId">;
  open: CommandEditingOpen;
  retired(): void;
  changed(): void;
}) => {
  const members = new Set<CommandEditingMember>();
  const serialize = createEditingCommandQueue();
  let closed = false;
  let ready: Promise<void> | undefined;
  let readExecutor: EditingExecutor | undefined;
  let disposal: Promise<void> | undefined;
  let retiredSnapshot: WebviewEditingSnapshot | undefined;
  const snapshot = () => {
    const current = journal.snapshot();
    const error = current.error ?? sources.error();
    return { ...current, ...(error ? { error } : {}) };
  };
  const publish = (accepted?: { member: CommandEditingMember; sequence: number }) => {
    if (closed) return;
    const current = snapshot();
    for (const member of members)
      member.events.emit({
        scope: "editing.session",
        payload: {
          sessionId: member.id,
          snapshot: current,
          ...(accepted?.member === member ? { appliedSequence: accepted.sequence } : {}),
        },
      });
    updateObservation();
    input.changed();
  };
  const journal = createCommandEditingJournal({
    command: input.open.command,
    serialize,
    changed: publish,
    accepted: (result) => sources.accept(result),
  });
  const sources = createCommandEditingSources({
    ...input,
    serialize,
    execute: () => {
      if (!readExecutor) throw editingFailure("editing_session_closed");
      return readExecutor;
    },
    accept: journal.accept,
    validate: journal.validate,
    changed: journal.touch,
    retired: input.retired,
  });
  const updateObservation = () => {
    let observation: "active" | "passive" | "none" = "none";
    if (members.size)
      observation = [...members].some((member) => member.workbench.activation.isActive()) ? "active" : "passive";
    else if (journal.active()) observation = "passive";
    sources.observe(observation);
  };
  const assertOpen = () => {
    if (closed || sources.retired()) throw editingFailure("editing_session_closed");
  };
  const close = (member: CommandEditingMember) => {
    members.delete(member);
    try {
      journal.cancel(member);
    } finally {
      readExecutor = [...members].at(-1)?.execute;
      updateObservation();
      input.changed();
    }
  };
  const retirement = () => ({
    value: {},
    version: journal.snapshot().version + 1,
    revision: 0,
    savedRevision: 0,
    hasDrafts: false,
    pendingCommands: 0,
    retired: true as const,
  });
  return {
    members,
    matchesCommand: (projectId: string | undefined, commandId: string) =>
      input.owner.projectId === projectId && input.open.command.commandId === commandId,
    retired: () => closed || sources.retired(),
    protected: () => members.size > 0 || journal.active(),
    requiredFor: journal.requiredFor,
    flush: (workbench?: CommandEditingMember["workbench"]) =>
      journal.flush(workbench).finally(() => {
        if (closed) journal.clear();
      }),
    updateObservation,
    async join(member: CommandEditingMember) {
      assertOpen();
      members.add(member);
      readExecutor = member.execute;
      updateObservation();
      ready ??= sources.initialize().then(() => sources.ready());
      await ready;
      assertOpen();
      if (!members.has(member)) throw editingFailure("editing_session_closed");
      return snapshot();
    },
    close,
    retireMember(member: CommandEditingMember) {
      try {
        member.events.emit({ scope: "editing.session", payload: { sessionId: member.id, snapshot: retirement() } });
      } finally {
        close(member);
      }
    },
    async request(member: CommandEditingMember, request: WebviewEditingSessionParams) {
      assertOpen();
      switch (request.operation) {
        case "preview":
          journal.preview(member, request);
          break;
        case "cancel":
          journal.cancel(member, request.sequence);
          break;
        case "execute":
          await journal.execute(member, request);
          break;
        case "save":
          await journal.flush();
          if (!closed) await sources.retry();
          break;
        default:
          throw editingFailure("editing_operation_not_supported");
      }
      return retiredSnapshot ?? snapshot();
    },
    dispose() {
      if (disposal) return disposal;
      const settled = Promise.withResolvers<void>();
      disposal = settled.promise;
      closed = true;
      retiredSnapshot = retirement();
      const errors: unknown[] = [];
      const release = (run: () => void) => {
        try {
          run();
        } catch (error) {
          errors.push(error);
        }
      };
      const retiring = [...members];
      members.clear();
      for (const member of retiring)
        release(() =>
          member.events.emit({
            scope: "editing.session",
            payload: { sessionId: member.id, snapshot: retiredSnapshot! },
          }),
        );
      release(sources.dispose);
      readExecutor = undefined;
      journal.clear();
      void journal
        .flush()
        .catch((error) => {
          errors.push(error);
        })
        .then(() => {
          journal.clear();
          if (errors.length) settled.reject(new AggregateError(errors, "Command editing could not finish"));
          else settled.resolve();
        });
      return disposal;
    },
  };
};
