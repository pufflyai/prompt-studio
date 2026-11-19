import { expect, test } from "bun:test";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { autoBuildDispatches } from "./auto-build-dispatches";
import { readAutoBuildOwnership } from "./auto-build-ownership";

test("run ownership pages dispatch metadata and selects only its workspaces' event session IDs", async () => {
  const storage = createMemoryStorage();
  const ctx = { storage };
  for (let i = 0; i < 203; i++)
    await autoBuildDispatches(ctx, "owner").put(String(i), { workspaceId: String(i), dispatchedAt: "2026-01-01" });
  for (let i = 0; i < 103; i++)
    await autoBuildDispatches(ctx, "other").put(`other-${i}`, {
      workspaceId: `other-${i}`,
      dispatchedAt: "2026-01-01",
    });
  await storage.collection("planner-attempt-events").put("late-review", {
    id: "late-review",
    workspaceId: "202",
    sessionId: "review",
    type: "review_requested",
    metadata: { body: "Big history. ".repeat(1000) },
  });
  const guard = (source: ExtensionStorageApi): ExtensionStorageApi => ({
    ...source,
    scope: (scope) => guard(source.scope(scope)),
    collection: <T>(name: string) => {
      const items = source.collection<T>(name);
      return {
        ...items,
        list: async () => {
          throw Error(`Unbounded ${name}`);
        },
        ...(name === "planner-attempt-events"
          ? {
              get: async () => {
                throw Error("History body materialized");
              },
            }
          : {}),
      };
    },
  });
  const ownership = await readAutoBuildOwnership({ storage: guard(storage) }, "owner");
  expect(ownership.attemptIds.size).toBe(203);
  expect(ownership.attemptIds.has("other-0")).toBe(false);
  expect(ownership.sessionIds).toEqual(new Set(["owner", "review"]));
});

test("pending run requests page bodies after following linked conversations beyond the first metadata page", async () => {
  const { readPendingAutoBuildRequests } = await import("./auto-build-ownership");
  const storage = createMemoryStorage();
  for (let i = 0; i < 104; i++)
    await storage.collection("planner-review-requests").put(`request-${String(i).padStart(3, "0")}`, {
      id: `request-${String(i).padStart(3, "0")}`,
      ticketId: "ticket",
      title: "Input",
      instructions: "Review",
      request: { kind: "task" },
      requestedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      requestedBy: { type: "human", id: "person", displayName: "Person" },
      context: {
        reason: null,
        workspaceId: null,
        attemptRevision: null,
        relatedSessionId: i === 103 ? "chat-102" : "owner",
        sessionId: `chat-${i}`,
      },
    });
  await storage
    .collection("planner-review-requests")
    .put("unrelated", { id: "unrelated", ticketId: "ticket", context: { sessionId: "manual" } });
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw Error(`Unbounded ${name}`);
    },
  });
  const first = await readPendingAutoBuildRequests({ storage }, "owner");
  expect(first.total).toBe(104);
  expect(first.requests).toHaveLength(25);
  const last = await readPendingAutoBuildRequests({ storage }, "owner", undefined, 100);
  expect(last.requests.map(({ id }) => id)).toEqual(["request-100", "request-101", "request-102", "request-103"]);
  expect(last.hasNext).toBe(false);
});

test("linked request and event pages survive writes between pages", async () => {
  const { linkedAutoBuildRequestPages } = await import("./auto-build-request-links");
  const { workspaceEventSessionPages } = await import("./attempt-queries");
  const storage = createMemoryStorage();
  const requests = storage.collection("planner-review-requests");
  const events = storage.collection("planner-attempt-events");
  for (let i = 0; i < 203; i++) {
    const id = String(i).padStart(3, "0");
    await requests.put(id, { id, context: { workspaceId: "workspace", sessionId: `chat-${id}` } });
    await events.put(id, { id, workspaceId: "workspace", sessionId: `session-${id}` });
  }
  const requestIds: string[] = [];
  for await (const page of linkedAutoBuildRequestPages(storage, {
    sessionIds: new Set(),
    attemptIds: new Set(["workspace"]),
  })) {
    requestIds.push(...page.map(({ id }) => id));
    await requests.put("000", {
      id: "000",
      context: { workspaceId: "workspace", sessionId: "chat-000" },
      resolved: true,
    });
  }
  expect(requestIds).toHaveLength(203);
  const sessionIds: string[] = [];
  for await (const page of workspaceEventSessionPages(storage, ["workspace"])) {
    sessionIds.push(...page);
    await events.put("000", { id: "000", workspaceId: "workspace", sessionId: "session-000", stopped: true });
  }
  expect(sessionIds).toHaveLength(203);
});

test("folder attempt ownership excludes sibling work in the same project workspace", async () => {
  const { linkedAutoBuildRequestPages } = await import("./auto-build-request-links");
  const storage = createMemoryStorage();
  const ctx = { storage };
  await autoBuildDispatches(ctx, "owner").put("owned-attempt", {
    attemptId: "owned-attempt",
    workspaceId: "home",
    dispatchedAt: "2026-01-01",
  });
  await autoBuildDispatches(ctx, "owner").put("legacy-workspace", {
    workspaceId: "legacy-workspace",
    dispatchedAt: "2026-01-01",
  });
  const { autoBuildPullRequestNotifications } = await import("./auto-build-dispatches");
  await autoBuildPullRequestNotifications(ctx, "owner").put("observed-workspace", { evidenceKey: "observation" });
  for (const [id, attemptId, workspaceId, sessionId] of [
    ["own-event", "owned-attempt", "home", "owned-session"],
    ["sibling-event", "sibling-attempt", "home", "sibling-session"],
    ["legacy-event", undefined, "legacy-workspace", "legacy-session"],
    ["observed-event", undefined, "observed-workspace", "observed-session"],
  ])
    await storage.collection("planner-attempt-events").put(id!, { id, attemptId, workspaceId, sessionId });
  for (const [id, attemptId, workspaceId] of [
    ["own-request", "owned-attempt", "home"],
    ["sibling-request", "sibling-attempt", "home"],
    ["legacy-request", undefined, "legacy-workspace"],
    ["foreign-request", "foreign-attempt", "legacy-workspace"],
  ])
    await storage.collection("planner-review-requests").put(id!, { id, context: { attemptId, workspaceId } });
  const ownership = await readAutoBuildOwnership(ctx, "owner");
  expect(ownership.attemptIds).toEqual(new Set(["owned-attempt", "legacy-workspace"]));
  expect(ownership.sessionIds).toEqual(new Set(["owner", "owned-session", "legacy-session"]));
  const requests: string[] = [];
  for await (const page of linkedAutoBuildRequestPages(storage, ownership)) requests.push(...page.map(({ id }) => id));
  expect(requests.sort()).toEqual(["legacy-request", "own-request"]);
  const { readRetiredWorkspaceIds } = await import("./attempt-retirement");
  await storage.collection("planner-attempt-events").put("abandoned", {
    id: "abandoned",
    attemptId: "owned-attempt",
    workspaceId: "home",
    type: "attempt_abandoned",
  });
  expect(await readRetiredWorkspaceIds(storage, ["owned-attempt"])).toEqual(new Set(["owned-attempt"]));
  expect(await readRetiredWorkspaceIds(storage, ["sibling-attempt"])).toEqual(new Set());
});
