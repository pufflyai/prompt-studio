import type { ScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations, operationSubject } from "../../core/registries/mutations/operations";
import type { TrackEditingCommand } from "./command-editing-journal";
import type { CommandEditingOpen, EditingOwner } from "./command-editing-types";
import type { CommandEditingJob } from "./command-editing-writer";

export const createCommandEditingRecovery = (
  queries: ScopedQueryClient,
  owner: Pick<EditingOwner, "projectId" | "extensionId">,
  open: CommandEditingOpen,
) => {
  const operations = getWorkbenchOperations(queries);
  const receipts = new WeakMap<CommandEditingJob, symbol>();
  const controller = new AbortController();
  const scope = { ...queries.getScope(), projectId: owner.projectId, extensionId: owner.extensionId };
  const stop = queries.subscribeScopeRetirement((retired) => {
    if (Object.entries(retired).every(([key, value]) => scope[key as keyof typeof scope] === value)) {
      controller.abort(new DOMException("The original editing authority is no longer active.", "AbortError"));
    }
  });
  const { signal } = controller;
  const track: TrackEditingCommand = async (job, write, accept, classify) => {
    signal.throwIfAborted();
    const previous = receipts.get(job);
    if (previous) await operations.transfer(previous, () => true);
    signal.throwIfAborted();

    const attempt = operations.submit({
      domain: "command.editing",
      projectId: owner.projectId,
      subjects: [operationSubject("command-editing", owner.projectId, owner.extensionId, open.key)],
      title: "Save shared changes",
      draft: {
        commandId: open.command.commandId,
        get changes() {
          return job.changes;
        },
      },
      write: (operationSignal) => write(AbortSignal.any([signal, operationSignal])),
      classify,
      reconcile: accept,
    });
    receipts.set(job, attempt.id);
    try {
      await attempt.result;
    } catch (error) {
      signal.throwIfAborted();
      throw error;
    }
  };
  return { track, stop };
};
