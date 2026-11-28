import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import type { WorkbenchCommandExecutionContext } from "../../core";
import type { ResourceChange } from "../../core/registries/resources/resource-preview";
import { unwrapCommandValue } from "./command-response";
import { runCommandConfirmation } from "./workbench-command-confirmation";
import type { WorkbenchExtensionCommandContext } from "./workbench-extension-command";

const noteRenameCommand = "pstdio.notes.command.notes.rename";
const noteTitleCheck = "pstdio.notes.command.notes.check-title";
type ExtensionCommand = WorkbenchExtensionMetadata["commands"][number];

const previewChange = (kind: "archive" | "remove" | "rename", label: unknown): ResourceChange => {
  if (kind === "archive") return { archived: true, attributeId: "archived", value: "archived" };
  if (kind === "remove") return { removed: true };
  return { label: (label as string).trim() };
};

const isPlannerDelete = (commandId?: string) =>
  commandId === "pstdio.planner.command.delete-ticket" || commandId === "pstdio.pstdio-planner.command.delete-ticket";

export const resolveWorkbenchResourceMutation = (command: ExtensionCommand | undefined) => {
  if (command?.resourceMutation) return command.resourceMutation;
  // Older Planner builds predate the declarative Delete preview.
  if (isPlannerDelete(command?.id)) return { kind: "remove", resourceType: "ticket", idParam: "id" } as const;
  // Planner archives keep the ticket accessible and change its board filter value.
  if (
    command?.id === "pstdio.planner.command.archive-ticket" ||
    command?.id === "pstdio.pstdio-planner.command.archive-ticket"
  )
    return { kind: "archive", resourceType: "ticket", idParam: "id" } as const;
  return undefined;
};

const leaveDeletingTicket = (context: WorkbenchExtensionCommandContext, resource: ResourceRef) => {
  const { workbench } = context;
  const { location, projectId } = workbench.pages.store.getState();
  if (projectId !== context.projectId || location?.page.id !== "ticket" || !location.resource) return;
  if (resourceKey({ projectId, ...location.resource }) !== resourceKey(resource)) return;
  if (location.parent && resourceKey(location.parent.resource) !== resourceKey(resource)) {
    workbench.pageLocations.navigateToParent();
    return;
  }
  void workbench.navigation
    .openPage({ page: { kind: "page", id: "tickets", extensionId: resource.extensionId ?? "pstdio.planner" } })
    .catch(workbench.notifications.captureActionError("Open Tickets"));
};

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
      ? runCommandConfirmation(context, command, params, persist, { signal: execution?.signal })
      : persist();
  const mutation = resolveWorkbenchResourceMutation(command);
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
  const deleteTicket = mutation.kind === "remove" && isPlannerDelete(command.id);
  const mutate = async () => {
    const result = context.workbench.resources.preview.submit(
      resource,
      persist,
      previewChange(mutation.kind, rawLabel),
      text(command.title, "Change resource"),
      noteRenameVerifier(context, command.id, id, rawLabel),
      typeof rawLabel === "string" ? rawLabel : undefined,
    );
    if (mutation.kind === "rename" && !command.confirmation) execution?.onAdmitted?.();
    if (deleteTicket && execution?.isViewerCurrent?.() !== false) leaveDeletingTicket(context, resource);
    return result;
  };
  if (mutation.kind !== "remove" && !command.confirmation) return mutate();
  return runCommandConfirmation(context, command, params, mutate, {
    resourceLabel: resource.label,
    signal: execution?.signal,
    closeOnConfirm: deleteTicket,
  });
};
