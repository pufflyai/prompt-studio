import { readFileSync } from "node:fs";
import { localTicketWorkflow } from "@pstdio/pstdio-ext-planner";
import {
  PLANNER_EXTENSION_ID,
  PLANNER_EXTENSION_PACKAGE_NAME,
  type PlannerTicketRecord,
  type PlannerTicketUpdateInput,
  type PlannerTicketUploadInput,
  type PlannerTicketWorkflowContext,
} from "@pstdio/pstdio-ext-planner/contract";
import type { createExtensionInstancesDBService } from "pstdio-db";
import { loadExtensionRuntime } from "pstdio-extensions";
import type { createPluginService } from "../features/plugins/plugin-service";
import type { EventBus } from "../features/sync/event-bus";
import { type TicketUpdateOperationInput, updateTicketWithHooks } from "../features/tickets/update-ticket-operation";
import type { createFileService } from "./file-service";
import type { createRepoService } from "./repo-service";
import type { createSessionService } from "./session-service";
import type { createStatusService } from "./status-service";
import type { createTagService } from "./tag-service";
import type { createTicketService } from "./ticket-service";
import type { createWorkspaceArtifactService } from "./workspace-artifact-service";
import type { createWorkspaceService } from "./workspace-service";
import type { createWorkspaceSessionService } from "./workspace-session-service";

type PlannerServiceDeps = {
  eventBus: EventBus;
  extensionInstancesDBService: ReturnType<typeof createExtensionInstancesDBService>;
  fileService: ReturnType<typeof createFileService>;
  pluginService: ReturnType<typeof createPluginService>;
  repoService: ReturnType<typeof createRepoService>;
  sessionService: ReturnType<typeof createSessionService>;
  statusService: ReturnType<typeof createStatusService>;
  tagService: ReturnType<typeof createTagService>;
  ticketService: ReturnType<typeof createTicketService>;
  workspaceArtifactService: ReturnType<typeof createWorkspaceArtifactService>;
  workspaceService: ReturnType<typeof createWorkspaceService>;
  workspaceSessionService: ReturnType<typeof createWorkspaceSessionService>;
};

type TicketRecord = NonNullable<Awaited<ReturnType<PlannerServiceDeps["ticketService"]["get"]>>>;
type FileRecord = NonNullable<Awaited<ReturnType<PlannerServiceDeps["fileService"]["get"]>>>;

export class PlannerWorkflowUnavailableError extends Error {}

const toPlannerFile = (file: FileRecord) => ({
  id: file.id,
  fileName: file.file_name,
  mimeType: file.mime_type,
});

const toPlannerTicket = async (
  deps: Pick<PlannerServiceDeps, "ticketService">,
  ticket: TicketRecord,
): Promise<PlannerTicketRecord> => {
  const tagOptions = await deps.ticketService.getTagOptionAssignments(ticket.id);

  return {
    id: ticket.id,
    projectId: ticket.project_id,
    shorthand: ticket.shorthand,
    createdAt: ticket.created_at,
    draft: ticket.draft,
    fileId: ticket.file_id,
    parentId: ticket.parent_id,
    userPrompt: ticket.user_prompt,
    dependsOn: ticket.depends_on,
    parallelizable: ticket.parallelizable,
    blockedReason: ticket.blocked_reason,
    tagNames: tagOptions.map((option) => option.name),
  };
};

const resolveProjectRoot = async (deps: Pick<PlannerServiceDeps, "repoService">, projectId: string) => {
  const [repo] = await deps.repoService.listByProject(projectId);
  if (!repo) {
    throw new PlannerWorkflowUnavailableError("Planner ticket workflow requires a linked project repository.");
  }

  return repo.path;
};

const listDisabledExtensionIds = async (
  deps: Pick<PlannerServiceDeps, "extensionInstancesDBService">,
  projectId: string,
) => {
  const instances = await deps.extensionInstancesDBService.list(projectId);
  return new Set(instances.filter((instance) => !instance.enabled).map((instance) => instance.extension_id));
};

const resolveWorkflow = async (deps: PlannerServiceDeps, projectId: string, repoPath?: string) => {
  const projectRoot = repoPath ?? (await resolveProjectRoot(deps, projectId));
  const runtime = await loadExtensionRuntime({ projectRoot });
  const disabledExtensionIds = await listDisabledExtensionIds(deps, projectId);

  if (disabledExtensionIds.has(PLANNER_EXTENSION_ID)) {
    throw new PlannerWorkflowUnavailableError(
      `Planner ticket workflow unavailable because extension "${PLANNER_EXTENSION_ID}" is disabled for this project. ` +
        `Enable "${PLANNER_EXTENSION_PACKAGE_NAME}" and run "pstdio extensions check" for diagnostics.`,
    );
  }

  const plannerExtension = runtime.extensions.find((extension) => extension.id === PLANNER_EXTENSION_ID);
  if (!plannerExtension) {
    throw new PlannerWorkflowUnavailableError(
      `Planner ticket workflow unavailable because extension "${PLANNER_EXTENSION_ID}" is not loaded. ` +
        `Enable "${PLANNER_EXTENSION_PACKAGE_NAME}" and run "pstdio extensions check" for diagnostics.`,
    );
  }

  return { projectRoot, workflow: localTicketWorkflow };
};

const findAttachedFile = async (
  deps: Pick<PlannerServiceDeps, "fileService">,
  ticketId: string,
  predicate: (file: FileRecord) => boolean,
) => {
  const files = await deps.fileService.listForTicket(ticketId);
  return files.find(predicate) ?? null;
};

const emitFileSet = (deps: Pick<PlannerServiceDeps, "eventBus">, file: unknown) => {
  deps.eventBus.emit("files", "set", file);
};

const emitTicketFileSet = (deps: Pick<PlannerServiceDeps, "eventBus">, ticketFile: unknown) => {
  if (ticketFile) deps.eventBus.emit("ticket_files", "set", ticketFile);
};

const emitWorkspaceArtifactSet = (deps: Pick<PlannerServiceDeps, "eventBus">, artifact: unknown) => {
  if (artifact) deps.eventBus.emit("workspace_artifacts", "set", artifact);
};

const uploadRelativeArtifact = async (
  deps: PlannerServiceDeps,
  ticket: TicketRecord,
  input: PlannerTicketUploadInput & { relativePath: string },
) => {
  const existingArtifact = await deps.workspaceArtifactService.getByTicketPath(ticket.id, input.relativePath);

  if (existingArtifact) {
    const existingFile = await deps.fileService.get(existingArtifact.file_id);

    if (existingFile) {
      const updated = await deps.fileService.update(existingFile.id, { data: input.content });
      if (updated) emitFileSet(deps, updated);

      const artifact = await deps.workspaceArtifactService.upsertByTicketPath(
        ticket.id,
        existingFile.id,
        input.relativePath,
      );
      emitWorkspaceArtifactSet(deps, artifact);

      return toPlannerFile(updated ?? existingFile);
    }
  }

  const file = await deps.fileService.upload({
    project_id: ticket.project_id,
    file_name: input.fileName,
    file_kind: "artifact",
    data: input.content,
    mime_type: input.mimeType ?? null,
  });

  const ticketFile = await deps.fileService.attachToTicket(ticket.id, file.id);
  const artifact = await deps.workspaceArtifactService.upsertByTicketPath(ticket.id, file.id, input.relativePath);
  emitFileSet(deps, file);
  emitTicketFileSet(deps, ticketFile);
  emitWorkspaceArtifactSet(deps, artifact);

  return toPlannerFile(file);
};

const uploadTicketFile = async (deps: PlannerServiceDeps, ticketId: string, input: PlannerTicketUploadInput) => {
  const ticket = await deps.ticketService.get(ticketId);
  if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

  if (input.relativePath) {
    return uploadRelativeArtifact(deps, ticket, { ...input, relativePath: input.relativePath });
  }

  const existing = await findAttachedFile(deps, ticketId, (file) => file.file_name === input.fileName);
  if (existing) {
    const updated = await deps.fileService.update(existing.id, { data: input.content });
    if (updated) emitFileSet(deps, updated);
    return toPlannerFile(updated ?? existing);
  }

  const file = await deps.fileService.upload({
    project_id: ticket.project_id,
    file_name: input.fileName,
    file_kind: "ticket_file",
    data: input.content,
    mime_type: input.mimeType ?? null,
  });
  const ticketFile = await deps.fileService.attachToTicket(ticket.id, file.id);
  emitFileSet(deps, file);
  emitTicketFileSet(deps, ticketFile);

  return toPlannerFile(file);
};

const toTicketUpdateInput = (input: PlannerTicketUpdateInput) =>
  ({
    blocked_reason: input.blockedReason,
    content: input.content,
    file_id: input.fileId,
    display_title: input.displayTitle,
    draft: input.draft,
    parent_id: input.parentId,
    status_id: input.statusId,
  }) satisfies TicketUpdateOperationInput;

const updateTicket = async (deps: PlannerServiceDeps, ticketId: string, input: PlannerTicketUpdateInput) => {
  const updated = await updateTicketWithHooks(deps, ticketId, {
    ...toTicketUpdateInput(input),
    tag_ids: input.tagIds,
  });
  if (!updated) return null;

  return toPlannerTicket(deps, updated);
};

const createWorkflowContext = (deps: PlannerServiceDeps, projectId: string, projectRoot: string) => {
  const context = {
    projectId,
    projectRoot,
    tickets: {
      get: async (ticketId) => {
        const ticket = await deps.ticketService.get(ticketId);
        return ticket ? toPlannerTicket(deps, ticket) : null;
      },
      getByShorthand: async (shorthand) => {
        const ticket = await deps.ticketService.getByShorthand(projectId, shorthand);
        return ticket ? toPlannerTicket(deps, ticket) : null;
      },
      list: async (input) => {
        const tickets = await deps.ticketService.list(projectId, { archived: input.archived });
        return Promise.all(tickets.map((ticket) => toPlannerTicket(deps, ticket)));
      },
      listFiles: async (ticketId) => {
        const files = await deps.fileService.listForTicket(ticketId);
        return files.map(toPlannerFile);
      },
      readFileContent: async (ticketId, fileId) => {
        const file = await findAttachedFile(deps, ticketId, (candidate) => candidate.id === fileId);
        if (!file) throw new Error(`Ticket file not found: ${fileId}`);
        return readFileSync(file.storage_path);
      },
      uploadFile: (ticketId, input) => uploadTicketFile(deps, ticketId, input),
      update: (ticketId, input) => updateTicket(deps, ticketId, input),
      resolveStatusId: async (statusName) => {
        const status = await deps.statusService.getByName(projectId, statusName);
        if (!status) throw new Error(`Status not found: ${statusName}`);
        return status.id;
      },
      resolveTagIds: async (tagNames) => {
        if (tagNames.length === 0) return [];
        const tags = await deps.tagService.listWithOptions(projectId);
        const options = tags.flatMap((tag) => tag.options);
        const ids: string[] = [];

        for (const tagName of tagNames) {
          const option = options.find((candidate) => candidate.name === tagName);
          if (!option) throw new Error(`Tag option not found: ${tagName}`);
          ids.push(option.id);
        }

        return ids;
      },
    },
  } satisfies PlannerTicketWorkflowContext;

  return context;
};

export const createPlannerService = (deps: PlannerServiceDeps) => {
  const pullTickets = async (projectId: string, input: { ticketId?: string; force?: boolean; repoPath?: string }) => {
    const { projectRoot, workflow } = await resolveWorkflow(deps, projectId, input.repoPath);
    return workflow.pull(createWorkflowContext(deps, projectId, projectRoot), input);
  };

  const pushTicket = async (
    projectId: string,
    input: { ticketId: string; status?: string; tags?: string[]; repoPath?: string },
  ) => {
    const { projectRoot, workflow } = await resolveWorkflow(deps, projectId, input.repoPath);
    return workflow.push(createWorkflowContext(deps, projectId, projectRoot), input);
  };

  return { pullTickets, pushTicket };
};
