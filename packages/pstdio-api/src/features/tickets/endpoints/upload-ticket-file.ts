import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
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

export const uploadTicketFileHandler = (deps: RouteDeps): AppRouteHandler<typeof uploadTicketFileRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { file_name, relative_path, content_base64, mime_type } = c.req.valid("json");

    const ticket = await deps.ticketService.get(id);
    if (!ticket) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const data = Buffer.from(content_base64, "base64");

    if (relative_path) {
      const existingArtifact = await deps.workspaceArtifactService.getByTicketPath(id, relative_path);

      if (existingArtifact) {
        const existingFile = await deps.fileService.get(existingArtifact.file_id);

        if (existingFile) {
          const updated = await deps.fileService.update(existingFile.id, { data });
          if (updated) {
            emitSyncedFile(deps, updated);
          }

          const artifact = await deps.workspaceArtifactService.upsertByTicketPath(id, existingFile.id, relative_path);
          emitSyncedWorkspaceArtifact(deps, artifact);

          return c.json(updated ?? existingFile, 200);
        }
      }

      const file = await deps.fileService.upload({
        project_id: ticket.project_id,
        file_name,
        file_kind: "artifact",
        data,
        mime_type: mime_type ?? null,
      });

      const ticketFile = await deps.fileService.attachToTicket(id, file.id);
      const artifact = await deps.workspaceArtifactService.upsertByTicketPath(id, file.id, relative_path);
      emitSyncedFile(deps, file);
      emitSyncedTicketFile(deps, ticketFile);
      emitSyncedWorkspaceArtifact(deps, artifact);

      return c.json(file, 201);
    }

    const attachedFiles = await deps.fileService.listForTicket(id);
    const existing = attachedFiles.find((file) => file.file_name === file_name);

    if (existing) {
      const updated = await deps.fileService.update(existing.id, { data });
      if (updated) {
        emitSyncedFile(deps, updated);
      }
      return c.json(updated ?? existing, 200);
    }

    const file = await deps.fileService.upload({
      project_id: ticket.project_id,
      file_name,
      file_kind: "ticket_file",
      data,
      mime_type: mime_type ?? null,
    });

    const ticketFile = await deps.fileService.attachToTicket(id, file.id);
    emitSyncedFile(deps, file);
    emitSyncedTicketFile(deps, ticketFile);

    return c.json(file, 201);
  };
};
