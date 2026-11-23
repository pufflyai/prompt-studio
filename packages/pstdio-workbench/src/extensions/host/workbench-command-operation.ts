import type { ExtensionCommandRecord } from "@pstdio/sdk/api";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import { operationSubject, type WorkbenchOperations } from "../../core/registries/mutations/operations";

export const extensionCommandOperation = "extension.command";

export const runWorkbenchCommandOperation = <T>(input: {
  operations: WorkbenchOperations;
  projectId: string;
  command: ExtensionCommandRecord;
  source?: ResourceRef;
  write(signal: AbortSignal): Promise<T>;
}) => {
  const { operations, projectId, command, source } = input;
  // The declaration does not promise a record identity. Match every invocation of the command in this project.
  const subject = operationSubject(extensionCommandOperation, projectId, command.id);
  if (operations.getSnapshot().pending.some((entry) => entry.subjects.includes(subject)))
    throw new Error("This action is still pending. See System activity for recovery.");
  return operations.submit({
    domain: extensionCommandOperation,
    projectId,
    subjects: [subject],
    title: text(command.title, "Run extension action"),
    source,
    draft: { commandId: command.id },
    describeRecovery: () => "The action could not be confirmed. Inspect its result before discarding the attempt.",
    releaseOnDiscard: true,
    showPending: true,
    classify: classifyApiWrite,
    write: input.write,
  }).result;
};
