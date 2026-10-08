import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { WorkbenchCommandExecutionContext } from "../../core";
import type { WorkbenchExtensionCommandContext } from "./workbench-extension-command";

export const runResourceMutation = async (
  context: WorkbenchExtensionCommandContext,
  command: WorkbenchExtensionMetadata["commands"][number],
  params: Record<string, unknown> | undefined,
  execution: WorkbenchCommandExecutionContext | undefined,
  persist: () => Promise<unknown>,
) => {
  const mutation = command.resourceMutation;
  if (!mutation) return persist();
  const id = params?.[mutation.idParam] ?? execution?.resource?.id;
  if (typeof id !== "string") return persist();
  const resource = { type: mutation.resourceType, id, extensionId: command.extensionId, projectId: context.projectId };
  if (mutation.kind === "remove") {
    if (!(await context.workbench.commandPalette.requestConfirmation(text(command.title, "Delete")))) return;
  }
  const rawLabel = mutation.kind === "rename" ? params?.[mutation.labelParam] : undefined;
  // Leave invalid input to the command; never display a title that it cannot save.
  if (mutation.kind === "rename" && (typeof rawLabel !== "string" || !rawLabel.trim())) return persist();
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
