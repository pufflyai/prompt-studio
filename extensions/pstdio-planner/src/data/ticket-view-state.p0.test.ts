import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketViewState } from "./ticket-view-state";

test("a project without milestones does not scan tickets to compute unused milestone progress", async () => {
  const storage = createMemoryStorage();
  let aggregates = 0;
  const aggregate = storage.records.aggregate;
  storage.records.aggregate = async (query) => {
    aggregates++;
    return aggregate(query);
  };
  const state = await ticketViewState(storage, {
    completedStatusIds: ["done"],
    blockedStatusIds: [],
    activeStatusIds: ["ready"],
    mergeTargetStatusId: null,
  });
  expect(state.metadata.deadlines).toEqual([]);
  expect(aggregates).toBe(0);
});
