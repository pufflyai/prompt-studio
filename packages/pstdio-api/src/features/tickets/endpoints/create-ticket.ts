import { createRoute, z } from "@hono/zod-openapi";
import { ticketEvents } from "@pstdio/sdk/extensions";
import type { AppRouteHandler } from "../../../types";
import { emitActivityEvent } from "../../activity/activity-events";
import { fireExtensionEventAsync } from "../../extensions/extension-event-runtime";
import { buildTicketPayload } from "../build-ticket-payload";
import type { TicketsRouteDeps } from "../deps";
import { createTicketBodySchema, ticketResponseSchema } from "../dto";
import { emitSyncedFile, emitSyncedTicketFile } from "../emit-ticket-file-sync";
import { extractTitleFromContent } from "../extract-title";

type TicketRecord = NonNullable<Awaited<ReturnType<TicketsRouteDeps["ticketService"]["get"]>>>;

type CreateTicketInput = z.infer<typeof createTicketBodySchema>;

const attachContentToTicket = async (
  deps: TicketsRouteDeps,
  ticket: TicketRecord,
  projectId: string,
  content: string,
) => {
  const data = Buffer.from(content);
  const file = await deps.fileService.upload({
    project_id: projectId,
    file_name: "ticket.md",
    file_kind: "ticket_file",
    data,
    mime_type: "text/markdown",
  });
  const ticketFile = await deps.fileService.attachToTicket(ticket.id, file.id);
  emitSyncedFile(deps, file);
  emitSyncedTicketFile(deps, ticketFile);
  const updated = await deps.ticketService.update(ticket.id, { file_id: file.id });
  if (!updated) throw new Error(`Ticket not found right after creation: ${ticket.id}`);
  return updated;
};

const assignTags = async (deps: TicketsRouteDeps, ticketId: string, tagIds: string[]) => {
  await deps.ticketService.assignTagOptions(ticketId, tagIds);
  const newAssignments = await deps.ticketService.listTagAssignments(ticketId);
  for (const row of newAssignments) deps.eventBus.emit("ticket_tag_assignments", "set", row);
};

const ensureProjectExists = async (deps: TicketsRouteDeps, projectId: string) => {
  return deps.projectService.get(projectId);
};

const resolveCreateStatusId = async (
  deps: Pick<TicketsRouteDeps, "statusService">,
  projectId: string,
  statusId: string | null | undefined,
) => {
  if (statusId) return statusId;
  const defaultStatus = await deps.statusService.getDefault(projectId);
  return defaultStatus?.id;
};

const finalizeCreatedTicket = async (
  deps: TicketsRouteDeps,
  ticket: TicketRecord,
  input: Omit<CreateTicketInput, "content" | "tag_ids">,
  content: string | undefined,
  tagIds: string[] | undefined,
) => {
  let nextTicket = ticket;

  if (content) {
    nextTicket = await attachContentToTicket(deps, nextTicket, input.project_id, content);
  }

  if (tagIds && tagIds.length > 0) {
    await assignTags(deps, nextTicket.id, tagIds);
  }

  deps.eventBus.emit("tickets", "set", nextTicket);
  await emitActivityEvent(deps, {
    projectId: nextTicket.project_id,
    resourceType: "ticket",
    resourceId: nextTicket.id,
    eventType: "ticket_created",
    summary: `Created ticket ${nextTicket.shorthand}`,
    payload: {
      status_id: nextTicket.status_id,
      draft: nextTicket.draft,
      parent_id: nextTicket.parent_id,
      tag_ids: tagIds ?? [],
    },
  });
  const postPayload = await buildTicketPayload(deps, nextTicket, input.project_id);
  fireExtensionEventAsync(deps, input.project_id, ticketEvents.created, {
    projectId: input.project_id,
    ticket: postPayload,
  });

  return nextTicket;
};

export const createTicketRoute = createRoute({
  method: "post",
  path: "/tickets",
  description: "Create a new ticket.",
  deprecated: true,
  tags: ["Tickets"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: createTicketBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Ticket created.",
      content: { "application/json": { schema: ticketResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const createTicketHandler = (deps: TicketsRouteDeps): AppRouteHandler<typeof createTicketRoute> => {
  return async (c) => {
    const { tag_ids, content, ...input } = c.req.valid("json");

    const project = await ensureProjectExists(deps, input.project_id);
    if (!project) {
      return c.json({ error: `Project not found: ${input.project_id}` }, 404);
    }

    const nextInput = {
      ...input,
      status_id: await resolveCreateStatusId(deps, input.project_id, input.status_id),
    };

    let ticket = await deps.ticketService.create({
      ...nextInput,
      display_title: content ? extractTitleFromContent(content) : undefined,
    });

    ticket = await finalizeCreatedTicket(deps, ticket, input, content, tag_ids);

    return c.json(ticket, 201);
  };
};
