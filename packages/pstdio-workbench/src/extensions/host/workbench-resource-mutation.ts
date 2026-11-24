import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { WorkbenchCommandExecutionContext } from "../../core";
import { unwrapCommandValue } from "./command-response";
import { runCommandConfirmation } from "./workbench-command-confirmation";
import type { WorkbenchExtensionCommandContext } from "./workbench-extension-command";

const noteRenameCommand = "pstdio.notes.command.notes.rename";
const noteTitleCheck = "pstdio.notes.command.notes.check-title";

const noteRenameVerifier = (
  context: WorkbenchExtensionCommandContext,
  commandId: string,
  id: string,
  title: unknown,
) => {
  if (
    commandId !== noteRenameCommand ||
    typeof title !== "string" ||
    !context.metadata?.commands.some((command) => command.id === noteTitleCheck)
  )
    return undefined;
  return async (signal: AbortSignal) => {
    const response = await context.executeCommand(
      noteTitleCheck,
      {
        projectId: context.projectId,
        params: { noteId: id, title },
        source: "dashboard",
      },
      signal,
    );
    const result = unwrapCommandValue(response) as { confirmed?: boolean } | undefined;
    return result?.confirmed === true;
  };
};

export const runResourceMutation = async (
  context: WorkbenchExtensionCommandContext,
  command: WorkbenchExtensionMetadata["commands"][number],
  params: Record<string, unknown> | undefined,
  execution: WorkbenchCommandExecutionContext | undefined,
  persist: (signal?: AbortSignal) => Promise<unknown>,
) => {
  const withoutPreview = () =>
    command.confirmation
      ? runCommandConfirmation(context, command, params, persist, undefined, execution?.signal)
      : persist();
  const mutation = command.resourceMutation;
  if (!mutation) return withoutPreview();
  const id = params?.[mutation.idParam] ?? execution?.resource?.id;
  if (typeof id !== "string") return withoutPreview();
  const subject = execution?.resource;
  // A command can present a resource whose canonical identity belongs to another provider.
  const resource =
    subject?.type === mutation.resourceType &&
    subject.id === id &&
    (!subject.projectId || subject.projectId === context.projectId)
      ? { ...subject, projectId: context.projectId }
      : { type: mutation.resourceType, id, extensionId: command.extensionId, projectId: context.projectId };
  const rawLabel = mutation.kind === "rename" ? params?.[mutation.labelParam] : undefined;
  // Leave invalid input to the command; never display a title that it cannot save.
  if (mutation.kind === "rename" && (typeof rawLabel !== "string" || !rawLabel.trim())) return withoutPreview();
  const mutate = async () => {
    const result = context.workbench.resources.preview.submit(
      resource,
      persist,
      mutation.kind === "remove" ? { removed: true } : { label: (rawLabel as string).trim() },
      text(command.title, "Change resource"),
      noteRenameVerifier(context, command.id, id, rawLabel),
    );
    if (mutation.kind === "rename" && !command.confirmation) execution?.onAdmitted?.();
    return result;
  };
  if (mutation.kind !== "remove" && !command.confirmation) return mutate();
  return runCommandConfirmation(context, command, params, mutate, resource.label, execution?.signal);
};
