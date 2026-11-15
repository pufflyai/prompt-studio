import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../../commands/command-context.fixture";
import { putTicket } from "../../data/ticket-context.fixture";
import { moveTicketInPlan } from "./move-ticket";
import { planPlacements } from "./placement-store";

test("moving a ticket through the command never reads the complete project", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, {
    id: "moving",
    shorthand: "T-1",
    title: "Moving",
    content: "",
    archived: false,
    statusId: "ready",
    createdAt: "now",
    updatedAt: "now",
  });
  await storage.set("timeline.plan", {
    deadlines: [{ id: "release", date: "2030-01-01" }],
    order: [
      { ticketId: "moving", deadlineId: null },
      { ticketId: "unloaded", deadlineId: "release" },
    ],
  });
  const ctx = makeCommandContext({ storage, params: {} });
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw new Error(`Unbounded ${name}`);
    },
  });
  storage.records.list = async () => {
    throw new Error("Unbounded records");
  };
  expect(await moveTicketInPlan(ctx, { ticket: "moving", deadline: "release" })).toMatchObject({
    ticketId: "moving",
    deadlineId: "release",
  });
  expect(await planPlacements(storage).get("unloaded")).toMatchObject({ deadlineId: "release" });
});
