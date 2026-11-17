import { type CommandContext, defineCommand, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
import { appendTicketPositionFromStorage } from "../data/indexed-ticket-order";
import { ensureTicketStorage } from "../data/read-migrated-tickets";
import { resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { ticketTagsForIds } from "../data/tag-cardinality";
import { withTicketOrder } from "../data/ticket-order";
import { ticketRecord, ticketRecordId } from "../data/ticket-records";
import type { StoredTicket } from "../data/types";
import { emitPlannerTicketsChanged } from "../events";
import { deriveTitle } from "../utils/derive-title";
import { resolveTicketAnchor } from "./ticket-actions";

export interface ImportedTicket {
  /** Local key, unique within one import, that `parent` and `dependsOn` can name. */
  key: string;
  title?: string;
  content?: string;
  /** Status name or ID. Defaults to the default status. */
  status?: string;
  /** Tag option names or IDs. */
  tags?: string[];
  /** A key from this import or an existing ticket's shorthand or ID. */
  parent?: string;
  dependsOn?: string[];
  links?: ({ workspace: string } | { session: string })[];
}

const MAX_TICKETS = 1000;
// Bounded save groups keep each records.commit under the 4 MiB group limit.
const GROUP_TICKETS = 100;
const GROUP_BYTES = 1024 * 1024;

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as never;

const validate = (tickets: unknown) => {
  if (!Array.isArray(tickets) || tickets.length === 0 || tickets.length > MAX_TICKETS)
    throw new Error(`Import 1 to ${MAX_TICKETS} tickets per call.`);
  const keys = new Set<string>();
  for (const ticket of tickets as ImportedTicket[]) {
    if (!ticket || typeof ticket.key !== "string" || !ticket.key) throw new Error("Every ticket needs a key.");
    if (keys.has(ticket.key)) throw new Error(`Ticket key "${ticket.key}" appears twice.`);
    keys.add(ticket.key);
    if (!ticket.title && !ticket.content) throw new Error(`Ticket "${ticket.key}" needs a title or content.`);
  }
  return tickets as ImportedTicket[];
};

const linkKey = (link: NonNullable<ImportedTicket["links"]>[number]) =>
  "workspace" in link ? JSON.stringify(["workspace", link.workspace]) : JSON.stringify(["session", link.session]);

const resolveStatuses = async (ctx: CommandContext, tickets: ImportedTicket[]) => {
  const statuses = await seedDefaultStatuses(ctx.storage);
  const fallback = (statuses.find((status) => status.isDefault) ?? statuses[0])?.id ?? null;
  const ids = new Map<string, string>();
  for (const value of new Set(tickets.flatMap((ticket) => (ticket.status ? [ticket.status] : []))))
    ids.set(value, await resolveStatusId(ctx.storage, value));
  return (value?: string) => (value ? ids.get(value)! : fallback);
};

const resolveTags = async (ctx: CommandContext, tickets: ImportedTicket[]) => {
  const values = [...new Set(tickets.flatMap((ticket) => ticket.tags ?? []))];
  if (!values.length) return new Map<string, string>();
  await seedDefaultTags(ctx.storage);
  const ids = await resolveTagOptionIds(ctx.storage, values);
  return new Map(values.map((value, index) => [value, ids[index]!]));
};

const resolveReferences = async (ctx: CommandContext, tickets: ImportedTicket[]) => {
  const keys = new Set(tickets.map((ticket) => ticket.key));
  const refs = tickets.flatMap((ticket) => [...(ticket.parent ? [ticket.parent] : []), ...(ticket.dependsOn ?? [])]);
  const existing = new Map<string, string>();
  for (const value of new Set(refs)) if (!keys.has(value)) existing.set(value, await resolveTicketId(ctx, value));
  return existing;
};

const resolveTargets = async (ctx: CommandContext, tickets: ImportedTicket[]) => {
  const targets = new Map<string, { kind: "workspace" | "session"; id: string }>();
  for (const link of tickets.flatMap((ticket) => ticket.links ?? [])) {
    if (targets.has(linkKey(link))) continue;
    if ("workspace" in link) {
      const workspace =
        (await ctx.workspaces.getByShorthand(link.workspace)) ?? (await ctx.workspaces.get(link.workspace));
      if (!workspace) throw new Error(`Unknown workspace "${link.workspace}"`);
      targets.set(linkKey(link), { kind: "workspace", id: workspace.id });
    } else {
      const session = await ctx.sessions.get(link.session);
      if (!session) throw new Error(`Unknown session "${link.session}"`);
      targets.set(linkKey(link), { kind: "session", id: session.id });
    }
  }
  return targets;
};

// Every name and reference resolves before anything is written, so an unknown one writes nothing.
const resolveInputs = async (ctx: CommandContext, tickets: ImportedTicket[]) => ({
  status: await resolveStatuses(ctx, tickets),
  tagIds: await resolveTags(ctx, tickets),
  existing: await resolveReferences(ctx, tickets),
  targets: await resolveTargets(ctx, tickets),
});

const allocate = async (ctx: CommandContext, count: number) => {
  const identities: { id: string; shorthand: string }[] = [];
  for (let offset = 0; offset < count; offset += 100)
    identities.push(...(await ctx.resources.allocateMany({ kind: "ticket", count: Math.min(100, count - offset) })));
  return identities;
};

const saveGroups = async (ctx: CommandContext, tickets: StoredTicket[]) => {
  let group: StoredTicket[] = [];
  let bytes = 0;
  const flush = async () => {
    if (!group.length) return;
    const outcome = await ctx.storage.records.commit({
      operationId: ctx.storage.ids.create(),
      edits: group.map((ticket) => ({
        recordId: ticketRecordId(ctx.storage, ticket.id),
        replace: json(ticketRecord(ticket)),
      })),
    });
    if (outcome.state === "refused") throw new Error("The ticket import was refused; no later groups were saved.");
    group = [];
    bytes = 0;
  };
  for (const ticket of tickets) {
    const size = JSON.stringify(ticket).length;
    if (group.length >= GROUP_TICKETS || (group.length && bytes + size > GROUP_BYTES)) await flush();
    group.push(ticket);
    bytes += size;
  }
  await flush();
};

const addLinks = async (
  ctx: CommandContext,
  tickets: ImportedTicket[],
  ids: Map<string, string>,
  targets: Awaited<ReturnType<typeof resolveInputs>>["targets"],
) => {
  const byTarget = new Map<string, string[]>();
  for (const ticket of tickets)
    for (const link of ticket.links ?? []) {
      const key = JSON.stringify([
        "workspace" in link ? "workspace" : "session",
        "workspace" in link ? link.workspace : link.session,
      ]);
      byTarget.set(key, [...(byTarget.get(key) ?? []), ids.get(ticket.key)!]);
    }
  for (const [key, ticketIds] of byTarget) {
    const target = targets.get(key)!;
    const anchors: ResourceAnchor[] = [];
    for (const id of new Set(ticketIds))
      anchors.push({ ...(await resolveTicketAnchor(ctx, id)).anchor, role: "context" as const });
    await (target.kind === "workspace" ? ctx.workspaces : ctx.sessions).addAnchors(target.id, anchors);
  }
};

// Creates many tickets in grouped record saves. Parents and dependencies can name other tickets
// in the same import by key, or existing tickets by shorthand or ID.
export const importTicketsCommand = defineCommand({
  id: "import-tickets",
  mutating: true,
  title: "Import tickets",
  cli: {
    examples: ['pst pstdio.planner import-tickets --tickets "$(cat tickets.json)"'],
  },
  params: { tickets: params.json<ImportedTicket[], { required: true }>({ required: true }) },
  async run(ctx, input) {
    const tickets = validate(input.tickets);
    await ensureTicketStorage(ctx);
    const resolved = await resolveInputs(ctx, tickets);
    const identities = await allocate(ctx, tickets.length);
    const ids = new Map(tickets.map((ticket, index) => [ticket.key, identities[index]!.id]));
    const reference = (value: string) => ids.get(value) ?? resolved.existing.get(value)!;
    const now = new Date().toISOString();
    await withTicketOrder(ctx, async () => {
      await ensureTicketStorage(ctx);
      let position = await appendTicketPositionFromStorage(ctx.storage);
      const stored: StoredTicket[] = [];
      for (const [index, ticket] of tickets.entries()) {
        position = ctx.storage.positions.between(position);
        const tagIds = (ticket.tags ?? []).map((value) => resolved.tagIds.get(value)!);
        stored.push({
          id: identities[index]!.id,
          title: ticket.content ? deriveTitle(ticket.content) : ticket.title!,
          content: ticket.content ?? "",
          statusId: resolved.status(ticket.status),
          tags: await ticketTagsForIds(ctx.storage, tagIds),
          attachments: [],
          parentId: ticket.parent ? reference(ticket.parent) : null,
          dependsOn: (ticket.dependsOn ?? []).map(reference),
          blockedReason: null,
          userPrompt: null,
          draft: false,
          archived: false,
          position,
          createdAt: now,
          updatedAt: now,
        } as StoredTicket);
      }
      await saveGroups(ctx, stored);
    });
    await addLinks(ctx, tickets, ids, resolved.targets);
    await emitPlannerTicketsChanged(ctx, {});
    return {
      tickets: Object.fromEntries(tickets.map((ticket, index) => [ticket.key, identities[index]!])),
    };
  },
});
