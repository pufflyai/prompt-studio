import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "./memory-storage";
import { inputRequestNameMigrationLegacyIds, migrateInputRequestNames } from "./migrate-input-request-names";

describe("migrateInputRequestNames", () => {
  test("moves stored input-request data to the current names and is idempotent", async () => {
    const storage = createMemoryStorage();
    const legacy = inputRequestNameMigrationLegacyIds;

    await storage.collection(legacy.tagsCollection).put(legacy.tagId, {
      id: legacy.tagId,
      name: "Flags",
      type: "multi_select",
      sortOrder: 3,
      options: [
        {
          id: legacy.optionId,
          name: legacy.optionName,
          color: "purple",
          sortOrder: 0,
          icon: "eye",
          description: null,
        },
      ],
    });
    await storage.collection(legacy.ticketsCollection).put("ticket-1", {
      id: "ticket-1",
      tagIds: [legacy.optionId, "default-type-feature"],
    });
    await storage.collection(legacy.requestsCollection).put("request-1", {
      id: "request-1",
      ticketId: "ticket-1",
      question: "Which attempt should continue?",
      state: "open",
    });
    await storage.collection(legacy.requestsCollection).put("request-2", {
      id: "request-2",
      ticketId: "ticket-1",
      question: "Which attempt was selected?",
      state: "resolved",
    });
    await storage.collection(legacy.selectionsCollection).put("ticket-1", {
      ticketId: "ticket-1",
      workspaceId: "workspace-1",
      [legacy.selectionField]: "request-1",
    });
    await storage.collection(legacy.eventsCollection).put("event-1", {
      id: "event-1",
      metadata: { [legacy.selectionField]: "request-1", reason: "selected" },
    });

    await migrateInputRequestNames(storage);
    await migrateInputRequestNames(storage);

    expect(await storage.collection("ticket-tags").get("default-awaiting-input")).toMatchObject({
      id: "default-awaiting-input",
      name: "Flags",
      options: [
        expect.objectContaining({
          id: "default-awaiting-input-true",
          name: "Awaiting Input",
          color: "orange",
          icon: "bell",
        }),
      ],
    });
    expect(await storage.collection("ticket-tags").get(legacy.tagId)).toBeUndefined();
    expect(await storage.collection("tickets").get("ticket-1")).toMatchObject({
      tagIds: ["default-awaiting-input-true", "default-type-feature"],
    });
    expect(await storage.collection("planner-input-requests").get("request-1")).toMatchObject({
      id: "request-1",
      ticketId: "ticket-1",
      question: "Which attempt should continue?",
      state: "open",
    });
    expect(await storage.collection("planner-input-requests").get("request-2")).toMatchObject({
      id: "request-2",
      ticketId: "ticket-1",
      state: "resolved",
    });
    expect(await storage.collection(legacy.requestsCollection).list()).toEqual([]);
    expect(await storage.collection("planner-attempt-selections").get("ticket-1")).toMatchObject({
      ticketId: "ticket-1",
      workspaceId: "workspace-1",
      inputRequestId: "request-1",
    });
    expect(await storage.collection("planner-attempt-events").get("event-1")).toMatchObject({
      metadata: { inputRequestId: "request-1", reason: "selected" },
    });
  });
});
