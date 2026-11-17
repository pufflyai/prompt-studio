import { type CommandContext, defineCommand, l10n, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
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
const MAX_TICKET_BYTES = 200 * 1024;

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as never;

// Existing tickets cannot name new ones, so only links between imported keys can form a cycle.
const rejectCycles = (tickets: ImportedTicket[], next: (ticket: ImportedTicket) => string[], kind: string) => {
  const byKey = new Map(tickets.map((ticket) => [ticket.key, ticket]));
  const done = new Set<string>();
  const visit = (key: string, path: Set<string>) => {
    if (path.has(key)) throw new Error(`Ticket "${key}" is part of a ${kind} cycle.`);
    if (done.has(key)) return;
    path.add(key);
    for (const value of next(byKey.get(key)!)) if (byKey.has(value)) visit(value, path);
    path.delete(key);
    done.add(key);
  };
  for (const ticket of tickets) visit(ticket.key, new Set());
};

// Exactly one of workspace or session, as a string.
// Imported parents and prerequisites are saved before the tickets that name them, so a failure
// partway through never leaves a saved ticket pointing at a ticket that was not saved.
const saveOrder = (tickets: ImportedTicket[]) => {
  const byKey = new Map(tickets.map((ticket, index) => [ticket.key, index]));
  const order: number[] = [];
  const seen = new Set<number>();
  const visit = (index: number) => {
    if (seen.has(index)) return;
    seen.add(index);
    const ticket = tickets[index]!;
    for (const ref of [...(ticket.parent ? [ticket.parent] : []), ...(ticket.dependsOn ?? [])]) {
      const target = byKey.get(ref);
      if (target !== undefined) visit(target);
    }
    order.push(index);
  };
  for (const index of tickets.keys()) visit(index);
  return order;
};

const validLink = (link: unknown) => {
  if (!link || typeof link !== "object") return false;
  const { workspace, session } = link as { workspace?: unknown; session?: unknown };
  return (typeof workspace === "string") !== (typeof session === "string") && (workspace ?? session) !== "";
};
const isString = (value: unknown) => typeof value === "string";
const optionalString = (value: unknown) => value === undefined || isString(value);
const optionalStrings = (value: unknown) => value === undefined || (Array.isArray(value) && value.every(isString));

/** The title and content a ticket is saved with; content's first line becomes the title. */
const ticketText = (ticket: ImportedTicket) => ({
  title: ticket.content ? deriveTitle(ticket.content) : ticket.title!,
  content: ticket.content ?? "",
});

const validateTicket = (ticket: ImportedTicket) => {
  const fields = [ticket.title, ticket.content, ticket.status, ticket.parent].every(optionalString);
  if (!fields || !optionalStrings(ticket.tags) || !optionalStrings(ticket.dependsOn))
    throw new Error(`Ticket "${ticket.key}" has a field of the wrong type.`);
  if (!ticket.title && !ticket.content) throw new Error(`Ticket "${ticket.key}" needs a title or content.`);
  if (ticket.links !== undefined && !(Array.isArray(ticket.links) && ticket.links.every(validLink)))
    throw new Error(`Ticket "${ticket.key}" needs exactly one workspace or session in each link.`);
  // One ticket is one record, and a record holds at most 256 KiB, including the derived title.
  if (new TextEncoder().encode(JSON.stringify({ ...ticket, ...ticketText(ticket) })).length > MAX_TICKET_BYTES)
    throw new Error(`Ticket "${ticket.key}" is larger than ${MAX_TICKET_BYTES / 1024} KiB.`);
};

const validate = (tickets: unknown) => {
  if (!Array.isArray(tickets) || tickets.length === 0 || tickets.length > MAX_TICKETS)
    throw new Error(`Import 1 to ${MAX_TICKETS} tickets per call.`);
  const keys = new Set<string>();
  for (const ticket of tickets as ImportedTicket[]) {
    if (!ticket || typeof ticket.key !== "string" || !ticket.key) throw new Error("Every ticket needs a key.");
    if (keys.has(ticket.key)) throw new Error(`Ticket key "${ticket.key}" appears twice.`);
    keys.add(ticket.key);
    validateTicket(ticket);
  }
  rejectCycles(tickets as ImportedTicket[], (ticket) => ticket.dependsOn ?? [], "dependency");
  rejectCycles(tickets as ImportedTicket[], (ticket) => (ticket.parent ? [ticket.parent] : []), "parent");
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

const saveGroups = async (ctx: CommandContext, tickets: StoredTicket[], progress: { ids: string[] }) => {
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
    if (outcome.state === "refused") throw new Error("Relay order refused a group of tickets.");
    progress.ids.push(...group.map((ticket) => ticket.id));
    group = [];
    bytes = 0;
  };
  for (const ticket of tickets) {
    const size = new TextEncoder().encode(JSON.stringify(ticket)).length;
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
  title: l10n("commands.importTickets", "Import tickets"),
  cli: {
    examples: ['pst pstdio.planner import-tickets --tickets "$(cat tickets.json)"'],
  },
  params: { tickets: params.json<ImportedTicket[], { required: true }>({ required: true }) },
  async run(ctx, input) {
    const tickets = validate(input.tickets);
    await ensureTicketStorage(ctx);
    const resolved = await resolveInputs(ctx, tickets);
    // Tag rules such as single-select are checked before any number is allocated.
    const tags: Awaited<ReturnType<typeof ticketTagsForIds>>[] = [];
    for (const ticket of tickets)
      tags.push(
        await ticketTagsForIds(
          ctx.storage,
          (ticket.tags ?? []).map((value) => resolved.tagIds.get(value)!),
        ),
      );
    const identities = await allocate(ctx, tickets.length);
    const ids = new Map(tickets.map((ticket, index) => [ticket.key, identities[index]!.id]));
    const reference = (value: string) => ids.get(value) ?? resolved.existing.get(value)!;
    const now = new Date().toISOString();
    const progress = { ids: [] as string[] };
    try {
      await withTicketOrder(ctx, async () => {
        await ensureTicketStorage(ctx);
        let position = await appendTicketPositionFromStorage(ctx.storage);
        const stored: StoredTicket[] = [];
        for (const [index, ticket] of tickets.entries()) {
          position = ctx.storage.positions.between(position);
          stored.push({
            id: identities[index]!.id,
            ...ticketText(ticket),
            statusId: resolved.status(ticket.status),
            tags: tags[index]!,
            attachments: [],
            parentId: ticket.parent ? reference(ticket.parent) : null,
            dependsOn: [...new Set((ticket.dependsOn ?? []).map(reference))],
            blockedReason: null,
            userPrompt: null,
            draft: false,
            archived: false,
            position,
            createdAt: now,
            updatedAt: now,
          } as StoredTicket);
        }
        await saveGroups(
          ctx,
          saveOrder(tickets).map((index) => stored[index]!),
          progress,
        );
      });
      await addLinks(ctx, tickets, ids, resolved.targets);
    } catch (error) {
      // Saved groups stay; name them so a retry can leave them out and point at their IDs.
      const keys = new Map([...ids].map(([key, id]) => [id, key]));
      const saved = progress.ids.map((id) => `${keys.get(id)}=${id}`);
      throw new Error(
        `The ticket import stopped after saving ${saved.length} of ${tickets.length} tickets` +
          (saved.length ? ` (${saved.join(", ")})` : "") +
          `: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    } finally {
      // Groups saved before a failure are already visible, so views refresh either way.
      await emitPlannerTicketsChanged(ctx, {}).catch(() => undefined);
    }
    return {
      tickets: Object.fromEntries(tickets.map((ticket, index) => [ticket.key, identities[index]!])),
    };
  },
});
