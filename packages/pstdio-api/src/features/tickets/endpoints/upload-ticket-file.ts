import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TicketsRouteDeps } from "../deps";
import { notFoundResponseSchema, ticketFileResponseSchema, uploadTicketFileBodySchema } from "../dto";
import { emitSyncedFile, emitSyncedTicketFile, emitSyncedWorkspaceArtifact } from "../emit-ticket-file-sync";

export const uploadTicketFileRoute = createRoute({
  method: "post",
  path: "/tickets/{id}/files",
  description: "Upload and attach a file to a ticket.",
  tags: ["Tickets"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Ticket ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: uploadTicketFileBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Ticket file updated.",
      content: { "application/json": { schema: ticketFileResponseSchema } },
    },
    201: {
      description: "Ticket file created.",
      content: { "application/json": { schema: ticketFileResponseSchema } },
    },
    404: {
      description: "Ticket not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

interface UploadTicketFileInput {
  ticketId: string;
  projectId: string;
  fileName: string;
  data: Buffer;
  mimeType: string | undefined;
}

interface UploadWorkspaceArtifactInput extends UploadTicketFileInput {
  relativePath: string;
}

const updateExistingWorkspaceArtifactFile = async (deps: TicketsRouteDeps, input: UploadWorkspaceArtifactInput) => {
  const existingArtifact = await deps.workspaceArtifactService.getByTicketPath(input.ticketId, input.relativePath);
  if (!existingArtifact) return null;

  const existingFile = await deps.fileService.get(existingArtifact.file_id);
  if (!existingFile) return null;

  const updated = await deps.fileService.update(existingFile.id, { data: input.data });
  if (updated) {
    emitSyncedFile(deps, updated);
  }

  const artifact = await deps.workspaceArtifactService.upsertByTicketPath(
    input.ticketId,
    existingFile.id,
    input.relativePath,
  );
  emitSyncedWorkspaceArtifact(deps, artifact);

  return { file: updated ?? existingFile, status: 200 as const };
};

const createWorkspaceArtifactFile = async (deps: TicketsRouteDeps, input: UploadWorkspaceArtifactInput) => {
  const file = await deps.fileService.upload({
    project_id: input.projectId,
    file_name: input.fileName,
    file_kind: "artifact",
    data: input.data,
    mime_type: input.mimeType ?? null,
  });

  const ticketFile = await deps.fileService.attachToTicket(input.ticketId, file.id);
  const artifact = await deps.workspaceArtifactService.upsertByTicketPath(input.ticketId, file.id, input.relativePath);
  emitSyncedFile(deps, file);
  emitSyncedTicketFile(deps, ticketFile);
  emitSyncedWorkspaceArtifact(deps, artifact);

  return { file, status: 201 as const };
};

const uploadWorkspaceArtifactFile = async (deps: TicketsRouteDeps, input: UploadWorkspaceArtifactInput) => {
  const updated = await updateExistingWorkspaceArtifactFile(deps, input);
  if (updated) return updated;

  return createWorkspaceArtifactFile(deps, input);
};

const updateExistingTicketFile = async (deps: TicketsRouteDeps, input: UploadTicketFileInput) => {
  const attachedFiles = await deps.fileService.listForTicket(input.ticketId);
  const existing = attachedFiles.find((file) => file.file_name === input.fileName);
  if (!existing) return null;

  const updated = await deps.fileService.update(existing.id, { data: input.data });
  if (updated) {
    emitSyncedFile(deps, updated);
  }

  return { file: updated ?? existing, status: 200 as const };
};

const createTicketFile = async (deps: TicketsRouteDeps, input: UploadTicketFileInput) => {
  const file = await deps.fileService.upload({
    project_id: input.projectId,
    file_name: input.fileName,
    file_kind: "ticket_file",
    data: input.data,
    mime_type: input.mimeType ?? null,
  });

  const ticketFile = await deps.fileService.attachToTicket(input.ticketId, file.id);
  emitSyncedFile(deps, file);
  emitSyncedTicketFile(deps, ticketFile);

  return { file, status: 201 as const };
};

const uploadAttachedTicketFile = async (deps: TicketsRouteDeps, input: UploadTicketFileInput) => {
  const updated = await updateExistingTicketFile(deps, input);
  if (updated) return updated;

  return createTicketFile(deps, input);
};

export const uploadTicketFileHandler = (deps: TicketsRouteDeps): AppRouteHandler<typeof uploadTicketFileRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { file_name, relative_path, content_base64, mime_type } = c.req.valid("json");

    const ticket = await deps.ticketService.get(id);
    if (!ticket) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const data = Buffer.from(content_base64, "base64");
    const input = {
      ticketId: id,
      projectId: ticket.project_id,
      fileName: file_name,
      data,
      mimeType: mime_type,
    };

    const result = relative_path
      ? await uploadWorkspaceArtifactFile(deps, { ...input, relativePath: relative_path })
      : await uploadAttachedTicketFile(deps, input);

    return result.status === 200 ? c.json(result.file, 200) : c.json(result.file, 201);
  };
};
