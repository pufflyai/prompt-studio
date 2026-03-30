import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { projects, ticket_tag_assignments, ticket_tag_options, tickets } from "../../db/schemas.pg";

type TicketRecord = typeof tickets.$inferSelect;

type CreateInput = {
  project_id: string;
  display_title?: string;
  user_prompt?: string;
  file_id?: string;
  parent_id?: string;
  draft?: boolean;
  status_id?: string;
};

type ListFilters = {
  status_id?: string;
  archived?: boolean;
  draft?: boolean;
  parent_id?: string;
  shorthand?: string;
  search?: string;
};

type UpdateInput = {
  display_title?: string | null;
  user_prompt?: string | null;
  file_id?: string | null;
  status_id?: string | null;
  parent_id?: string | null;
  blocked_reason?: string | null;
  depends_on?: string | null;
  archived?: boolean;
  draft?: boolean;
};

const nowTimestamp = () => new Date().toISOString();

const nextTicketShorthand = (projectShorthand: string, existingCount: number) =>
  `${projectShorthand}-${existingCount + 1}`;

export const createTicketsDBService = (db: DbClient) => {
  const create = async (input: CreateInput) => {
    const [project] = await db
      .select({ shorthand: projects.shorthand })
      .from(projects)
      .where(eq(projects.id, input.project_id));

    if (!project) throw new Error(`Project not found: ${input.project_id}`);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(eq(tickets.project_id, input.project_id));

    const shorthand = nextTicketShorthand(project.shorthand, countResult.count);
    const timestamp = nowTimestamp();

    const record: TicketRecord = {
      id: crypto.randomUUID(),
      shorthand,
      project_id: input.project_id,
      status_id: input.status_id ?? null,
      display_title: input.display_title ?? null,
      user_prompt: input.user_prompt ?? null,
      file_id: input.file_id ?? null,
      parallelizable: null,
      parent_id: input.parent_id ?? null,
      blocked_reason: null,
      depends_on: null,
      archived: false,
      draft: input.draft ?? false,
      deleted_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await db.insert(tickets).values(record);
    return record;
  };

  const get = async (id: string) => {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id), sql`${tickets.deleted_at} is null`));
    return ticket ?? null;
  };

  const getByShorthand = async (projectId: string, shorthand: string) => {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(
        and(eq(tickets.project_id, projectId), eq(tickets.shorthand, shorthand), sql`${tickets.deleted_at} is null`),
      );
    return ticket ?? null;
  };

  const list = async (projectId: string, filters: ListFilters = {}) => {
    const conditions = [eq(tickets.project_id, projectId), sql`${tickets.deleted_at} is null`];

    if (filters.status_id) conditions.push(eq(tickets.status_id, filters.status_id));
    if (filters.parent_id) conditions.push(eq(tickets.parent_id, filters.parent_id));
    if (filters.shorthand) conditions.push(eq(tickets.shorthand, filters.shorthand));
    if (filters.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      conditions.push(sql`(
        lower(coalesce(${tickets.display_title}, '')) like ${term}
        or lower(coalesce(${tickets.user_prompt}, '')) like ${term}
        or lower(${tickets.shorthand}) like ${term}
      )`);
    }

    if (filters.archived !== undefined) conditions.push(eq(tickets.archived, filters.archived));
    conditions.push(eq(tickets.draft, filters.draft ?? false));

    const rows = await db
      .select()
      .from(tickets)
      .where(and(...conditions))
      .orderBy(tickets.created_at);

    return rows;
  };

  const update = async (id: string, input: UpdateInput) => {
    const [updated] = await db
      .update(tickets)
      .set({ ...input, updated_at: nowTimestamp() })
      .where(and(eq(tickets.id, id), sql`${tickets.deleted_at} is null`))
      .returning();
    return updated ?? null;
  };

  const assignTagOptions = async (ticketId: string, optionIds: string[]) => {
    await db.delete(ticket_tag_assignments).where(eq(ticket_tag_assignments.ticket_id, ticketId));

    if (optionIds.length === 0) return;

    const timestamp = nowTimestamp();
    await db.insert(ticket_tag_assignments).values(
      optionIds.map((optionId) => ({
        id: crypto.randomUUID(),
        ticket_id: ticketId,
        ticket_tag_option_id: optionId,
        created_at: timestamp,
      })),
    );
  };

  const getTagOptionAssignments = async (ticketId: string) => {
    const rows = await db
      .select({ option: ticket_tag_options })
      .from(ticket_tag_assignments)
      .innerJoin(ticket_tag_options, eq(ticket_tag_assignments.ticket_tag_option_id, ticket_tag_options.id))
      .where(eq(ticket_tag_assignments.ticket_id, ticketId));

    return rows.map((r) => r.option);
  };

  const softDelete = async (id: string) => {
    const timestamp = nowTimestamp();
    const [updated] = await db
      .update(tickets)
      .set({ deleted_at: timestamp, updated_at: timestamp })
      .where(and(eq(tickets.id, id), sql`${tickets.deleted_at} is null`))
      .returning();
    return updated ?? null;
  };

  const listTagAssignments = async (ticketId: string) =>
    db.select().from(ticket_tag_assignments).where(eq(ticket_tag_assignments.ticket_id, ticketId));

  return {
    create,
    get,
    getByShorthand,
    list,
    update,
    softDelete,
    assignTagOptions,
    getTagOptionAssignments,
    listTagAssignments,
  };
};
