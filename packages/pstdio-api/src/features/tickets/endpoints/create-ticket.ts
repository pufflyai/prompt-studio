import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { fireTicketHook, fireTicketHookAsync } from "../../hooks/ticket-hooks";
import { buildTicketPayload } from "../build-ticket-payload";
import { createTicketBodySchema, ticketResponseSchema } from "../dto";
import { emitSyncedFile, emitSyncedTicketFile } from "../emit-ticket-file-sync";
import { extractTitleFromContent } from "../extract-title";

const hookRejectedSchema = z.object({ error: z.string() });

type TicketRecord = NonNullable<Awaited<ReturnType<RouteDeps["ticketService"]["get"]>>>;

type CreateTicketInput = z.infer<typeof createTicketBodySchema>;

const attachContentToTicket = async (deps: RouteDeps, ticket: TicketRecord, projectId: string, content: string) => {
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

const assignTags = async (deps: RouteDeps, ticketId: string, tagIds: string[]) => {
  await deps.ticketService.assignTagOptions(ticketId, tagIds);
  const newAssignments = await deps.ticketService.listTagAssignments(ticketId);
  for (const row of newAssignments) deps.eventBus.emit("ticket_tag_assignments", "set", row);
};

const ensureProjectExists = async (deps: RouteDeps, projectId: string) => {
  return deps.projectService.get(projectId);
};

const resolveCreateStatusId = async (
  deps: Pick<RouteDeps, "statusService">,
  projectId: string,
  statusId: string | null | undefined,
) => {
  if (statusId) return statusId;
  const defaultStatus = await deps.statusService.getDefault(projectId);
  return defaultStatus?.id;
};

const resolveStatusName = async (
  deps: Pick<RouteDeps, "statusService">,
  projectId: string,
  statusId: string | null | undefined,
) => {
  if (!statusId) return null;
  const statuses = await deps.statusService.list(projectId);
  return statuses.find((status) => status.id === statusId)?.name ?? null;
};

const runPreCreateHook = async (
  deps: RouteDeps,
  input: Omit<CreateTicketInput, "content" | "tag_ids"> & { status_id?: string | null },
  content: string | undefined,
  tagIds: string[] | undefined,
) => {
  const displayTitle = content ? extractTitleFromContent(content) : undefined;
  const statusName = await resolveStatusName(deps, input.project_id, input.status_id);
  const preHook = await fireTicketHook(deps, "preTicketCreation", input.project_id, {
    id: null,
    shorthand: null,
    displayTitle: displayTitle ?? null,
    userPrompt: input.user_prompt ?? null,
    content: content ?? null,
    parentId: input.parent_id ?? null,
    draft: input.draft ?? false,
    archived: false,
    status: statusName,
    tagIds: tagIds ?? [],
    tagNames: [],
    fileIds: [],
  });

  return {
    displayTitle,
    rejected: preHook.rejected,
    error: preHook.stderr.trim() || "Rejected by pre-ticket-creation hook",
  };
};

const finalizeCreatedTicket = async (
  deps: RouteDeps,
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
  const postPayload = await buildTicketPayload(deps, nextTicket, input.project_id);
  fireTicketHookAsync(deps, "postTicketCreation", input.project_id, postPayload);

  return nextTicket;
};

export const createTicketRoute = createRoute({
  method: "post",
  path: "/tickets",
  description: "Create a new ticket.",
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
    403: {
      description: "Rejected by pre-ticket-creation hook.",
      content: { "application/json": { schema: hookRejectedSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const createTicketHandler = (deps: RouteDeps): AppRouteHandler<typeof createTicketRoute> => {
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

    const preHook = await runPreCreateHook(deps, nextInput, content, tag_ids);
    if (preHook.rejected) {
      return c.json({ error: preHook.error }, 403);
    }

    let ticket = await deps.ticketService.create({
      ...nextInput,
      display_title: preHook.displayTitle,
    });

    ticket = await finalizeCreatedTicket(deps, ticket, input, content, tag_ids);

    return c.json(ticket, 201);
  };
};
