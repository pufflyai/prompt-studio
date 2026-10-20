import { ticketContext, ticketsCollection } from "./ticket-context.fixture";
import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";

import { findTicket, resolveStatusId, resolveTagId, resolveTagOptionIds, resolveTicketId } from "./resolve";
import { reviewRequestsCollection } from "./review-request-storage";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";
import { observeStorageReads } from "./storage-reads.fixture";

describe("resolveStatusId", () => {
  test("resolves by id and by case-insensitive name", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);

    expect(await resolveStatusId(storage, "ready")).toBe("ready");
    expect(await resolveStatusId(storage, "in progress")).toBe("in-progress");
  });

  test("throws a clear error for an unknown status", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);

    await expect(resolveStatusId(storage, "nope")).rejects.toThrow(/Unknown status "nope"/);
  });
});

describe("resolveTagId", () => {
  test("resolves a tag definition by name", async () => {
    const storage = createMemoryStorage();
    await seedDefaultTags(storage);

    expect(await resolveTagId(storage, "Priority")).toBe("default-priority");
  });
});

describe("resolveTagOptionIds", () => {
  test("maps option names to ids across tags", async () => {
    const storage = createMemoryStorage();
    await seedDefaultTags(storage);

    expect(await resolveTagOptionIds(storage, ["High", "Bug"])).toEqual(["default-priority-high", "default-type-bug"]);
  });

  test("throws for an unknown option", async () => {
    const storage = createMemoryStorage();
    await seedDefaultTags(storage);

    await expect(resolveTagOptionIds(storage, ["ghost"])).rejects.toThrow(/Unknown tag option "ghost"/);
  });
});

describe("resolveTicketId", () => {
  test("resolves by shorthand and id", async () => {
    const storage = createMemoryStorage();
    await ticketsCollection(storage).put("t1", {
      id: "t1",
      shorthand: "T-1",
      title: "First",
      content: "",
      statusId: null,
      archived: false,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
    });

    expect(await resolveTicketId(ticketContext(storage), "T-1")).toBe("t1");
    expect(await resolveTicketId(ticketContext(storage), "t1")).toBe("t1");
  });
});

describe("findTicket", () => {
  test("reads a ticket ID directly without scanning other tickets", async () => {
    const storage = createMemoryStorage();
    await ticketsCollection(storage).put("ticket-1", {
      id: "ticket-1",
      shorthand: "PS-1",
      title: "Selected ticket",
      content: "",
      statusId: null,
      tagIds: [],
      archived: false,
      sortOrder: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await reviewRequestsCollection(storage).put("request-1", {
      id: "request-1",
      ticketId: "ticket-1",
      title: "Confirm the scope",
      instructions: "Confirm before continuing.",
      request: { kind: "task" },
      requestedAt: "2026-01-01T00:00:00.000Z",
      requestedBy: { type: "agent", id: "agent-1", displayName: "Agent" },
      context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: null, relatedSessionId: null },
    });
    const observed = observeStorageReads(storage);

    const ticket = await findTicket({ ...ticketContext(storage), storage: observed.storage }, "ticket-1");

    expect(ticket?.tagIds).toEqual([]);
    expect(observed.reads.filter((key) => key.startsWith("tickets/"))).toEqual(["tickets/ticket-1"]);
  });

  test("resolves a shorthand that was stored with surrounding whitespace", async () => {
    const storage = createMemoryStorage();
    const tickets = ticketsCollection(storage);
    await tickets.createIfAbsent("ticket-1", {
      id: "ticket-1",
      shorthand: " PS-1",
      title: "Padded shorthand",
      content: "",
      statusId: null,
      tagIds: [],
      archived: false,
      sortOrder: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never);

    expect(await resolveTicketId(ticketContext(storage), "PS-1")).toBe("ticket-1");
  });
});
