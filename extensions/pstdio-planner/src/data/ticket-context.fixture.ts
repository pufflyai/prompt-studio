import type { ExtensionStorageApi, ResourceIdentity } from "@pstdio/sdk/extensions";
import {
  connectMemoryQueryResources,
  createMemoryStorage,
  type MemoryStorageOptions,
  makeCommandContext,
} from "@pstdio/sdk/testing";
import { ticketsCollection as collection, putTicket as put } from "./collections";
import { withTicketIdentities } from "./ticket-identity";
import { TICKET_KEY_PREFIX, TICKETS_COLLECTION } from "./ticket-record-address";
import { readTicketTags, type StoredTicketRecord } from "./ticket-tag-storage";
import type { Ticket } from "./types";

const seeded = new WeakMap<ExtensionStorageApi, Map<string, ResourceIdentity>>();
const identitiesFor = (storage: ExtensionStorageApi) => {
  let identities = seeded.get(storage);
  if (!identities) {
    identities = new Map();
    seeded.set(storage, identities);
  }
  return identities;
};

// Existing behavior fixtures use readable IDs and numbers. Keep their core identities
// separate from Planner records, as the host does for allocated tickets.
export const seedTicketIdentity = (
  storage: ExtensionStorageApi,
  ticket: Pick<Ticket, "id" | "shorthand" | "aliases">,
) => {
  identitiesFor(storage).set(ticket.id, {
    id: ticket.id,
    kind: "ticket",
    shorthand: ticket.shorthand.trim(),
    aliases: ticket.aliases ?? [],
  });
};

export const ticketContext = (storage: ExtensionStorageApi) => {
  const ctx = makeCommandContext({
    storage,
    params: {},
    resourcePrefixes: { ticket: "T" },
    overrides: { extensionId: "planner" },
  });
  const core = ctx.resources;
  ctx.resources = {
    ...core,
    identity: async (input) => identitiesFor(storage).get(input.id) ?? core.identity(input),
    identityMany: async ({ kind, ids }) => {
      const values = await core.identityMany({ kind, ids });
      return ids.map((id, index) => identitiesFor(storage).get(id) ?? values[index] ?? null);
    },
    findByShorthand: async (input) => [
      ...[...identitiesFor(storage).values()].filter(
        (identity) => identity.shorthand === input.shorthand || identity.aliases.includes(input.shorthand),
      ),
      ...(await core.findByShorthand(input)).filter(({ id }) => !identitiesFor(storage).has(id)),
    ],
  };
  connectMemoryQueryResources(storage, ctx.resources);
  return { storage, resources: ctx.resources };
};

export const putTicket = async (storage: ExtensionStorageApi, ticket: Ticket) => {
  seedTicketIdentity(storage, ticket);
  return put(ticketContext(storage), ticket);
};
export const ticketsCollection = (storage: ExtensionStorageApi) => {
  const ctx = ticketContext(storage);
  const records = collection(ctx);
  return {
    ...records,
    list: async () =>
      withTicketIdentities(ctx, (await storage.collection<StoredTicketRecord>("tickets").list()).map(readTicketTags)),
    put: async (id: string, ticket: Ticket) => {
      seedTicketIdentity(storage, ticket);
      await records.put(id, ticket);
    },
    update: async (id: string, ticket: Ticket) => {
      seedTicketIdentity(storage, ticket);
      await records.update(id, ticket);
    },
    createIfAbsent: async (id: string, ticket: Ticket) => {
      if (await records.get(id)) return false;
      seedTicketIdentity(storage, ticket);
      await records.put(id, ticket);
      return true;
    },
  };
};

/**
 * A project already on storage version 5: each ticket is a record, and the deprecated collection
 * redirects to them. Seeding records skips the one-time move of large ticket sets.
 */
export const createTicketRecordStorage = async (tickets: Ticket[], options: MemoryStorageOptions = {}) => {
  const storage = createMemoryStorage({
    ...options,
    kv: { ...options.kv, ...Object.fromEntries(tickets.map((ticket) => [`${TICKET_KEY_PREFIX}${ticket.id}`, ticket])) },
  });
  await storage.migrate(5, (_previous, migration) =>
    migration.moveCollection(TICKETS_COLLECTION, { keyPrefix: TICKET_KEY_PREFIX }).then(() => undefined),
  );
  return storage;
};
