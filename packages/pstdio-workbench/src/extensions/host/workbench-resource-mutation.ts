import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchCommandExecutionContext } from "../../core";
import { runCommandConfirmation } from "./workbench-command-confirmation";
import type { WorkbenchExtensionCommandContext } from "./workbench-extension-command";

export const runResourceMutation = async (
  context: WorkbenchExtensionCommandContext,
  command: WorkbenchExtensionMetadata["commands"][number],
  params: Record<string, unknown> | undefined,
  execution: WorkbenchCommandExecutionContext | undefined,
  persist: () => Promise<unknown>,
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
    const preview = context.workbench.resources.preview.begin(
      resource,
      mutation.kind === "remove" ? { removed: true } : { label: (rawLabel as string).trim() },
    );
    try {
      const result = await context.workbench.resources.preview.persist(resource, persist);
      await preview.commit();
      return result;
    } catch (error) {
      preview.rollback();
      throw error;
    }
  };
  if (mutation.kind !== "remove" && !command.confirmation) return mutate();
  return runCommandConfirmation(context, command, params, mutate, resource.label, execution?.signal);
};
