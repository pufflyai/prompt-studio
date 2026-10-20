import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { putTicket, ticketsCollection } from "./collections";
import { migratePlannerStorage } from "./migrate-storage";
import type { StoredTicket } from "./types";

const ticket = {
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Ticket",
  content: "# Ticket",
  statusId: "ready",
  archived: false,
  sortOrder: 0,
  createdAt: "2026-10-02T09:00:00.000Z",
  updatedAt: "2026-10-02T09:00:00.000Z",
  parallelizable: "no",
} as StoredTicket;

test("a project that already imported its templates gets the remaining cleanups once", async () => {
  const storage = createMemoryStorage({
    legacyData: {
      templates: {
        version: "0027-before-removal",
        records: [{ id: "file", name: "custom", template_type: "prompt", file_id: "file", deleted_at: null }],
      },
    },
  });
  await storage.migrate(1, async () => {});
  await putTicket(storage, ticket);
  await storage.set("workspace-status-definitions-initialized", true);
  const ctx = makeCommandContext({ storage, params: {} });

  await migratePlannerStorage(ctx);

  expect(await ticketsCollection(storage).get(ticket.id)).not.toHaveProperty("parallelizable");
  expect(await storage.get("workspace-status-definitions-initialized")).toBeUndefined();
  expect(await storage.collection("templates").list()).toEqual([]);
});
