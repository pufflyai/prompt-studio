import { expect, test } from "bun:test";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket, ticketsCollection } from "../data/collections";
import { ticketFilesDir, ticketMarkdownPath } from "../data/draft-storage";
import type { StoredTicket } from "../data/types";
import { makeCommandArgs } from "./command-context.fixture";
import { resolveTicketPathCommand } from "./resolve-ticket-path";

const storedTicket = (id: string, shorthand: string, extra: Partial<StoredTicket> = {}) =>
  ({
    id,
    shorthand,
    title: "Fix links",
    content: "",
    statusId: null,
    archived: false,
    sortOrder: 0,
    createdAt: "2026-10-16",
    updatedAt: "2026-10-16",
    ...extra,
  }) satisfies StoredTicket;

// Counts full reads of the ticket list on a real in-memory storage.
const countTicketLists = (storage: ExtensionStorageApi) => {
  let lists = 0;
  const collection = storage.collection.bind(storage);
  storage.collection = ((name: string) => {
    const target = collection(name);
    if (name !== "tickets") return target;
    return new Proxy(target, {
      get: (value, key) => {
        if (key === "list")
          return () => {
            lists += 1;
            return value.list();
          };
        const member = Reflect.get(value, key);
        return typeof member === "function" ? member.bind(value) : member;
      },
    });
  }) as typeof storage.collection;
  return {
    lists: () => lists,
    reset: () => {
      lists = 0;
    },
  };
};

const resolver = (storage: ExtensionStorageApi, projectId: string) => (path: string) =>
  resolveTicketPathCommand.run(...makeCommandArgs({ storage, projectId, params: { path, workspaceId: "workspace" } }));

test("after one full read, ticket paths and their parents resolve without reading every ticket", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, storedTicket("parent", "T-1", { title: "Epic" }));
  await putTicket(storage, storedTicket("child", "T-2", { parentId: "parent" }));
  const counter = countTicketLists(storage);
  const resolve = resolver(storage, "lookup-project");
  await resolve(ticketMarkdownPath("T-1"));
  counter.reset();
  expect(await resolve(ticketMarkdownPath("T-2"))).toMatchObject({
    resource: {
      id: "child",
      label: "T-2 Fix links",
      metadata: { resourceParent: { id: "parent", label: "T-1 Epic" } },
    },
  });
  expect(counter.lists()).toBe(0);
});

test("a ticket created after the last full read is found, then without reading every ticket", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, storedTicket("first", "T-1"));
  const counter = countTicketLists(storage);
  const resolve = resolver(storage, "new-ticket-project");
  await resolve(ticketMarkdownPath("T-1"));
  await putTicket(storage, storedTicket("later", "T-3"));
  expect(await resolve(ticketMarkdownPath("T-3"))).toMatchObject({ resource: { id: "later" } });
  counter.reset();
  expect(await resolve(ticketMarkdownPath("T-3"))).toMatchObject({ resource: { id: "later" } });
  expect(counter.lists()).toBe(0);
});

test("lookups that start together share one full read", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, storedTicket("one", "T-1"));
  await putTicket(storage, storedTicket("two", "T-2"));
  const counter = countTicketLists(storage);
  const resolve = resolver(storage, "together-project");
  const results = await Promise.all([resolve(ticketMarkdownPath("T-1")), resolve(ticketMarkdownPath("T-2"))]);
  expect(results).toMatchObject([{ resource: { id: "one" } }, { resource: { id: "two" } }]);
  expect(counter.lists()).toBe(1);
});

test("a parent cycle stops the parent walk", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, storedTicket("a", "T-1", { parentId: "b" }));
  await putTicket(storage, storedTicket("b", "T-2", { parentId: "a" }));
  expect(await resolver(storage, "cycle-project")(ticketMarkdownPath("T-1"))).toMatchObject({ resource: { id: "a" } });
});

test("a renumbered ticket no longer answers to its old shorthand", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, storedTicket("ticket", "T-1"));
  const resolve = resolver(storage, "renumber-project");
  expect(await resolve(ticketMarkdownPath("T-1"))).toMatchObject({ resource: { id: "ticket" } });
  await putTicket(storage, storedTicket("ticket", "T-5"));
  expect(await resolve(ticketMarkdownPath("T-1"))).toBeNull();
  expect(await resolve(ticketMarkdownPath("T-5"))).toMatchObject({ resource: { id: "ticket" } });
});

test("ticket draft paths open the ticket and saved file paths select the document", async () => {
  const storage = createMemoryStorage();
  const ticket = storedTicket("ticket-1", "T-1", {
    files: [{ id: "notes", name: "notes.md", blobId: "unused", createdAt: "2026-10-16", updatedAt: "2026-10-16" }],
  });
  await ticketsCollection(storage).put(ticket.id, ticket);
  const resolve = resolver(storage, "draft-project");
  expect(await resolve(ticketMarkdownPath("T-1"))).toMatchObject({
    resource: { id: ticket.id, label: "T-1 Fix links", icon: "component" },
    target: { page: { id: "ticket" }, resource: { id: ticket.id }, parent: { page: { id: "tickets" } } },
  });
  expect(await resolve(`${ticketFilesDir("T-1")}/notes.md`)).toMatchObject({
    resource: { label: "notes.md", metadata: { documentId: "notes" } },
    target: { resource: { metadata: { documentId: "notes" } } },
  });
  expect(await resolve(ticketMarkdownPath("T-99"))).toBeNull();
  expect(await resolve(`${ticketFilesDir("T-1")}/missing.md`)).toBeNull();
  expect(await resolve(ticketMarkdownPath("T-1").replace("ticket.md", "notes.md"))).toBeNull();
});
