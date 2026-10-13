import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { attemptEventsCollection, readAttempt } from "./attempt-storage";
import { upgradeAttemptStorage } from "./attempt-upgrade";

const timestamp = "2026-10-13T08:00:00.000Z";
test("concurrent upgrades preserve all variant history, requests, selections, and retirement", async () => {
  const storage = createMemoryStorage();
  const states = ["implementing", "review_ready", "reviewing", "approved", "changes_requested", "blocked", "abandoned"];
  for (const state of states) {
    const record = {
      schemaVersion: 1,
      workspaceId: state,
      workspaceShorthand: `WS-${state}`,
      ticketId: "ticket",
      ticketShorthand: "PS-1",
      implementationSessionId: "owner",
      state,
      base: { workspaceId: "parent", headSha: "base" },
      revisions: [
        {
          revision: 1,
          baseSha: "base",
          headSha: "head",
          changeRequestReportId: "report",
          submittedAt: timestamp,
          submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
          reviews: [
            {
              id: "review",
              sessionId: "reviewer",
              reportId: null,
              reviewedHeadSha: "head",
              reviewer: { type: "agent", id: "reviewer", displayName: "Reviewer" },
              state: "started",
              verdict: null,
              startedAt: timestamp,
              completedAt: null,
              supersedesReviewId: null,
            },
          ],
        },
      ],
      implementationDisconnectRetries: 0,
      reviewDisconnectRetries: 0,
      blocker: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await storage.collection("planner-attempts").put(state, record);
  }
  await storage.collection("planner-attempt-selections").put("ticket", { ticketId: "ticket", workspaceId: "approved" });
  await storage.collection("planner-review-requests").put("request", { ticketId: "ticket", id: "request" });
  await storage.set("auto-build", { enabled: true, prompt: "Build", ignore: { conjunction: "and", rules: [] } });
  await Promise.all([upgradeAttemptStorage(storage), upgradeAttemptStorage(storage), upgradeAttemptStorage(storage)]);
  for (const state of states) {
    const upgraded = await readAttempt(storage, state);
    expect(upgraded).toMatchObject({
      workspaceId: state,
      ticketId: "ticket",
      implementationSessionId: "owner",
      base: { headSha: "base" },
      revisions: [
        {
          headSha: "head",
          changeRequestReportId: "report",
          reviews: [{ id: "review", sessionId: "reviewer", reviewedHeadSha: "head" }],
        },
      ],
    });
    expect(await storage.collection("planner-attempts-v1-backup").get(state)).toMatchObject({ state });
  }
  await upgradeAttemptStorage(storage);
  expect(
    (await attemptEventsCollection(storage).list()).filter((event) => event.type === "attempt_abandoned"),
  ).toHaveLength(1);
  expect(await storage.collection("planner-attempt-selections").get("ticket")).toMatchObject({
    workspaceId: "approved",
  });
  expect(await storage.collection("planner-review-requests").get("request")).toMatchObject({ id: "request" });
  expect(await storage.get("auto-build")).toMatchObject({
    enabled: false,
    eligible: { conjunction: "and", rules: [] },
    ignore: { rules: [] },
  });
});

test("separate host contexts report contention without interrupting a healthy upgrade", async () => {
  const storage = createMemoryStorage();
  const original = storage.collection.bind(storage);
  let released!: () => void;
  const gate = new Promise<void>((resolve) => {
    released = resolve;
  });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const host = {
    ...storage,
    collection: <T>(name: string) => {
      const collection = original<T>(name);
      if (name !== "planner-attempts") return collection;
      return {
        ...collection,
        list: async () => {
          entered();
          await gate;
          return collection.list();
        },
      };
    },
  };
  const first = upgradeAttemptStorage(host);
  await started;
  await expect(upgradeAttemptStorage({ ...storage })).rejects.toThrow("write claim");
  await Bun.sleep(1100);
  released();
  await first;
  await upgradeAttemptStorage({ ...storage });
  expect(await storage.collection("planner-storage-migrations").get("agent-owned-progress-v2")).toEqual({
    complete: true,
  });
});
