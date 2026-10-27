import { expect, test } from "bun:test";
import { createMemoryStorage, createMemoryStorageDevices } from "@pstdio/sdk/testing";
import { attemptEventsCollection, readAttempt } from "./attempt-storage";
import { upgradeAttemptStorage } from "./attempt-upgrade";

const timestamp = "2026-10-13T08:00:00.000Z";

test("an already-migrated device and an offline source copy keep one retirement event", async () => {
  const owner = { workbenchId: "shared-project", extensionId: "pstdio.pstdio-planner" };
  const pair = await createMemoryStorageDevices({
    ...owner,
    collections: {
      "planner-attempts": {
        retired: {
          schemaVersion: 1,
          workspaceId: "retired",
          workspaceShorthand: "WS-1",
          ticketId: "ticket",
          ticketShorthand: "PS-1",
          implementationSessionId: "owner",
          state: "abandoned",
          base: { workspaceId: null, headSha: "base" },
          revisions: [],
          implementationDisconnectRetries: 0,
          reviewDisconnectRetries: 0,
          blocker: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    },
  });
  const expected = "legacy-retirement:retired";
  await pair.devices[0]
    .scope({ type: "planner-storage-upgrade", id: "agent-owned-progress-v2" })
    .migrate(1, async () => {
      await pair.devices[0].collection("planner-attempt-events").put(expected, {
        id: expected,
        workspaceId: "retired",
        type: "attempt_abandoned",
        createdAt: timestamp,
      });
      const legacy = await pair.devices[0].collection<Record<string, unknown>>("planner-attempts").get("retired");
      const { state: _state, ...record } = legacy!;
      await pair.devices[0].collection("planner-attempts").put("retired", { ...record, schemaVersion: 2 });
    });
  for (const storage of pair.devices) {
    await upgradeAttemptStorage(storage);
    await upgradeAttemptStorage(storage);
    expect(await attemptEventsCollection(storage).list()).toMatchObject([{ id: expected, workspaceId: "retired" }]);
  }
  await pair.merge();
  for (const storage of pair.devices) {
    expect(await attemptEventsCollection(storage).list()).toHaveLength(1);
    expect(await storage.collection("planner-attempts").get("retired")).toMatchObject({ schemaVersion: 2 });
  }
});

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

test("separate host contexts wait for one upgrade instead of failing", async () => {
  const storage = createMemoryStorage();
  await storage
    .collection("planner-attempts")
    .put("legacy", { schemaVersion: 1, workspaceId: "legacy", state: "blocked" });
  const original = storage.collection.bind(storage);
  let released!: () => void;
  const gate = new Promise<void>((resolve) => {
    released = resolve;
  });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let scans = 0;
  const host = {
    ...storage,
    collection: <T>(name: string) => {
      const collection = original<T>(name);
      if (name !== "planner-attempts") return collection;
      return {
        ...collection,
        list: async () => {
          scans++;
          entered();
          await gate;
          return collection.list();
        },
      };
    },
  };
  const first = upgradeAttemptStorage(host);
  await started;
  let waited = false;
  const second = upgradeAttemptStorage({ ...storage }).then(() => {
    waited = true;
  });
  await Bun.sleep(10);
  expect(waited).toBe(false);
  released();
  await Promise.all([first, second]);
  expect(scans).toBe(1);
  expect(await storage.collection("planner-attempts").get("legacy")).toMatchObject({ schemaVersion: 2 });
});
