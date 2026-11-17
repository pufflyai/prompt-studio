import { type CommandContext, defineCommand, l10n, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
import { appendTicketPositionFromStorage } from "../data/indexed-ticket-order";
import { ensureTicketStorage } from "../data/read-migrated-tickets";
import { resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { withTicketOrder } from "../data/ticket-order";
import { ticketRecord, ticketRecordId } from "../data/ticket-records";
import { assertOneTagValue, ticketTagsFromIds } from "../data/ticket-tags";
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
// Below the 4 MiB group limit, leaving room for record metadata.
const MAX_COMPONENT_BYTES = 3 * 1024 * 1024;

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
// Tickets that name each other through parents and dependencies (an epic that depends on its own
// child, say) form one component. Components come out with the ones they name first, so groups saved
// in this order never leave a saved ticket naming one that was not saved, and a component is never
// split across two saves.
export const saveComponents = (tickets: ImportedTicket[]) => {
  const byKey = new Map(tickets.map((ticket, index) => [ticket.key, index]));
  const refs = (index: number) => {
    const ticket = tickets[index]!;
    return [...(ticket.parent ? [ticket.parent] : []), ...(ticket.dependsOn ?? [])].flatMap((key) => {
      const target = byKey.get(key);
      return target === undefined ? [] : [target];
    });
  };
  // Tarjan's strongly connected components emit each component after the components it reaches.
  const order: number[][] = [];
  const low = new Map<number, number>();
  const found = new Map<number, number>();
  const stack: number[] = [];
  const onStack = new Set<number>();
  let next = 0;
  const visit = (index: number) => {
    found.set(index, next);
    low.set(index, next++);
    stack.push(index);
    onStack.add(index);
    for (const target of refs(index)) {
      if (!found.has(target)) {
        visit(target);
        low.set(index, Math.min(low.get(index)!, low.get(target)!));
      } else if (onStack.has(target)) low.set(index, Math.min(low.get(index)!, found.get(target)!));
    }
    if (low.get(index) !== found.get(index)) return;
    const component: number[] = [];
    let member: number;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== index);
    order.push(component);
  };
  for (const index of tickets.keys()) if (!found.has(index)) visit(index);
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
  for (const component of saveComponents(tickets as ImportedTicket[])) {
    const members = component.map((index) => (tickets as ImportedTicket[])[index]!);
    const bytes = members.reduce(
      (sum, ticket) => sum + new TextEncoder().encode(JSON.stringify({ ...ticket, ...ticketText(ticket) })).length,
      0,
    );
    if (bytes > MAX_COMPONENT_BYTES)
      throw new Error(`Tickets that name each other (${members[0]!.key} and others) must fit in one save of 3 MiB.`);
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

const saveGroups = async (ctx: CommandContext, components: StoredTicket[][], progress: { ids: string[] }) => {
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
  // A component stays in one save even when it alone is larger than a usual group.
  for (const component of components) {
    const size = component.reduce((sum, ticket) => sum + new TextEncoder().encode(JSON.stringify(ticket)).length, 0);
    if (group.length && (group.length + component.length > GROUP_TICKETS || bytes + size > GROUP_BYTES)) await flush();
    group.push(...component);
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
    // Tag rules such as single-select are checked before any number is allocated. The tag list is
    // read once for the whole import.
    const tagDefinitions = await seedDefaultTags(ctx.storage);
    const tags = tickets.map((ticket) => {
      const ids = (ticket.tags ?? []).map((value) => resolved.tagIds.get(value)!);
      for (const tag of tagDefinitions) assertOneTagValue(tag, ids);
      return ticketTagsFromIds(tagDefinitions, ids);
    });
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
          saveComponents(tickets).map((component) => component.map((index) => stored[index]!)),
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
