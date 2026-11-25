import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../../commands/command-context.fixture";
import { createTicketCommand } from "../../commands/create-ticket";
import { sessionRecord } from "../../commands/session-record.fixture";
import { ticketsCollection } from "../../data/ticket-context.fixture";

import { createGateCommand } from "./gate-commands";
import { gateLaunches, gates } from "./gate-store";
import { checkGateLaunchCommand, launchGateCommand } from "./launch-gate";

test.each(["id", "shorthand"] as const)("archived tickets cannot launch a gate review by %s", async (identity) => {
  const storage = createMemoryStorage();
  const effects: string[] = [];
  const [ctx] = makeCommandArgs({
    storage,
    params: {},
    overrides: {
      sessions: {
        create: async () => {
          effects.push("session");
          return sessionRecord({ id: "unexpected", title: "Review", status: "in_progress" });
        },
      },
      navigation: {
        open: () => {
          effects.push("navigation");
        },
      },
    },
  });
  const ticket = await createTicketCommand.run(ctx, { title: "Archived unfinished work" });
  await ticketsCollection(storage).put(ticket.id, { ...ticket, archived: true });

  await expect(launchGateCommand.run(ctx, { ticket: ticket[identity] })).rejects.toThrow("Unknown ticket");
  expect(await gates(ctx).get(ticket.id)).toBeUndefined();
  expect(effects).toEqual([]);
});

test("preserves a gate ticket after failed registration and registers it on review retry", async () => {
  const storage = createMemoryStorage();
  const collection = storage.collection.bind(storage);
  let failed = false;
  storage.collection = ((name: string) => {
    const real = collection(name);
    if (name !== "timeline.agent-gates") return real;
    return {
      ...real,
      createIfAbsent: async (...args: Parameters<typeof real.createIfAbsent>) => {
        if (!failed) {
          failed = true;
          throw new Error("Storage unavailable");
        }
        return real.createIfAbsent(...args);
      },
    };
  }) as typeof storage.collection;
  const [ctx] = makeCommandArgs({
    storage,
    params: {},
    overrides: {
      sessions: {
        create: async () =>
          sessionRecord({
            id: "gate-session",
            title: "Gate review",
            type: "session" as const,
            status: "in_progress" as const,
          }),
      },
      navigation: { open: () => {} },
    },
  });
  const result = await createGateCommand.run(ctx, { content: "# Review the preview" });
  expect(result.launchError).toContain("Storage unavailable");
  expect(result.launchStatus).toBe("refused");
  expect(await ticketsCollection(storage).list()).toHaveLength(1);
  await launchGateCommand.run(ctx, { ticket: result.ticket.id });
  expect(await gates(ctx).get(result.ticket.id)).toEqual({ ticketId: result.ticket.id });
  expect(await ticketsCollection(storage).list()).toHaveLength(1);
});

test("checks an unconfirmed review by its exact anchor and only replaces an explicitly confirmed ended session", async () => {
  const storage = createMemoryStorage();
  const linked = new Map<string, ReturnType<typeof sessionRecord>>();
  const opened: string[] = [];
  let creates = 0;
  let showCreatedSession = false;
  let failReplacementRead = false;
  const [ctx] = makeCommandArgs({
    storage,
    params: {},
    overrides: {
      sessions: {
        create: async ({ anchors = [] }) => {
          const anchor = anchors.find((item) => item.type === "planner-gate-launch")!;
          expect(anchor).toMatchObject({ projectId: "proj-1", extensionId: "pstdio.planner", role: "context" });
          const session = sessionRecord({ id: `review-${++creates}`, title: "Review", status: "completed" });
          linked.set(anchor.id, session);
          if (creates === 1) throw new Error("The launch response was lost");
          return session;
        },
        query: async (query) => {
          expect(query).toMatchObject({
            anchor: { type: "planner-gate-launch", projectId: "proj-1", extensionId: "pstdio.planner" },
            includeArchived: true,
            limit: 1,
          });
          if (failReplacementRead && query?.anchor?.id.endsWith(":replacement")) throw new Error("Pending read");
          const session = linked.get(query?.anchor?.id ?? "");
          return { items: showCreatedSession && session ? [session] : [], nextCursor: null };
        },
      },
      navigation: {
        open: (target) => {
          if (target.kind === "panel" && target.resource) opened.push(target.resource.id);
        },
      },
    },
  });
  const result = await createGateCommand.run(ctx, { content: "# Check dependencies" });
  const ticket = result.ticket.id;
  expect(result.launchStatus).toBe("unconfirmed");
  await expect(checkGateLaunchCommand.run(ctx, { ticket })).resolves.toEqual({ status: "unconfirmed" });
  await expect(launchGateCommand.run(ctx, { ticket })).rejects.toThrow("unconfirmed");
  expect(creates).toBe(1);
  expect(opened).toEqual([]);

  showCreatedSession = true;
  await expect(checkGateLaunchCommand.run(ctx, { ticket })).resolves.toMatchObject({
    status: "confirmed",
    session: { id: "review-1" },
  });
  await expect(launchGateCommand.run(ctx, { ticket })).resolves.toMatchObject({ id: "review-1" });
  await expect(launchGateCommand.run(ctx, { ticket, after: "another-session" })).resolves.toMatchObject({
    id: "review-1",
  });
  await expect(
    launchGateCommand.run(ctx, { ticket, after: "review-1", attemptId: "replacement" }),
  ).resolves.toMatchObject({ id: "review-2" });
  failReplacementRead = true;
  await expect(launchGateCommand.run(ctx, { ticket, attemptId: result.launchAttemptId })).resolves.toMatchObject({
    id: "review-1",
  });
  failReplacementRead = false;
  await expect(launchGateCommand.run(ctx, { ticket, attemptId: result.launchAttemptId })).resolves.toMatchObject({
    id: "review-1",
  });
  expect(creates).toBe(2);
  expect(opened).toEqual(["review-1", "review-1", "review-1", "review-2", "review-1", "review-1"]);
});

test("releases a definitively refused launch and preserves a prior completed review when replacement is refused", async () => {
  const linked = new Map<string, ReturnType<typeof sessionRecord>>();
  let hasHarness = false;
  const [ctx] = makeCommandArgs({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        create: async ({ anchors = [] }) => {
          if (!hasHarness) {
            const error = new Error("No harness available.");
            error.name = "SessionCreateRefused";
            throw error;
          }
          const anchor = anchors.find((item) => item.type === "planner-gate-launch")!;
          const session = sessionRecord({ id: "confirmed", title: "Review", status: "completed" });
          linked.set(anchor.id, session);
          return session;
        },
        query: async (query) => {
          const session = linked.get(query?.anchor?.id ?? "");
          return { items: session ? [session] : [], nextCursor: null };
        },
      },
      navigation: { open: () => {} },
    },
  });
  const result = await createGateCommand.run(ctx, { content: "# Review the configured harness" });
  const ticket = result.ticket.id;
  expect(result.launchError).toContain("No harness available");
  expect(result.launchStatus).toBe("refused");
  expect(await gateLaunches(ctx).get(ticket)).toBeUndefined();
  await expect(checkGateLaunchCommand.run(ctx, { ticket })).resolves.toEqual({ status: "ready" });
  hasHarness = true;
  await expect(launchGateCommand.run(ctx, { ticket, attemptId: "first" })).resolves.toMatchObject({ id: "confirmed" });
  hasHarness = false;
  await expect(launchGateCommand.run(ctx, { ticket, after: "confirmed", attemptId: "failed" })).rejects.toMatchObject({
    name: "GateLaunchRefused",
  });
  await expect(checkGateLaunchCommand.run(ctx, { ticket })).resolves.toMatchObject({
    status: "confirmed",
    launchId: "first",
    session: { id: "confirmed" },
  });
  await expect(checkGateLaunchCommand.run(ctx, { ticket, attemptId: "failed" })).resolves.toMatchObject({
    status: "unconfirmed",
  });
});

test("a different attempt that loses the gate reservation cannot remain unconfirmed as a writer", async () => {
  const beforeReserve = Promise.withResolvers<void>();
  const winner = Promise.withResolvers<string>();
  const release = Promise.withResolvers<void>();
  const linked = new Map<string, ReturnType<typeof sessionRecord>>();
  let waiting = 0;
  let writes = 0;
  const [ctx] = makeCommandArgs({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      workspaces: {
        getDefault: async () => {
          if (++waiting === 2) beforeReserve.resolve();
          await beforeReserve.promise;
          return { id: "workspace" } as never;
        },
      },
      sessions: {
        create: async ({ anchors = [] }) => {
          const anchor = anchors.find((item) => item.type === "planner-gate-launch")!;
          const attemptId = anchor.id.split(":").at(-1)!;
          writes++;
          winner.resolve(attemptId);
          await release.promise;
          const session = sessionRecord({ id: "winner-session", title: "Gate review", status: "in_progress" });
          linked.set(anchor.id, session);
          return session;
        },
        query: async (query) => {
          const session = linked.get(query?.anchor?.id ?? "");
          return { items: session ? [session] : [], nextCursor: null };
        },
      },
      navigation: { open: () => {} },
    },
  });
  const { id: ticket } = await createTicketCommand.run(ctx, { title: "Concurrent reviews" });
  const attempts = new Map(
    ["first", "second"].map((attemptId) => [attemptId, launchGateCommand.run(ctx, { ticket, attemptId })]),
  );
  const settled = Promise.allSettled(attempts.values());
  try {
    const winningId = await winner.promise;
    const losingId = winningId === "first" ? "second" : "first";
    await expect(attempts.get(losingId)!).rejects.toMatchObject({ name: "GateLaunchRefused" });
    await expect(launchGateCommand.run(ctx, { ticket, attemptId: "later" })).rejects.toMatchObject({
      name: "GateLaunchRefused",
    });
    await expect(launchGateCommand.run(ctx, { ticket, attemptId: winningId })).rejects.toThrow("unconfirmed");
    expect(writes).toBe(1);
    release.resolve();
    await expect(attempts.get(winningId)!).resolves.toMatchObject({ id: "winner-session" });
    await expect(checkGateLaunchCommand.run(ctx, { ticket, attemptId: losingId })).resolves.toEqual({
      status: "unconfirmed",
    });
    await expect(launchGateCommand.run(ctx, { ticket, attemptId: "retry" })).resolves.toMatchObject({
      id: "winner-session",
    });
    expect(writes).toBe(1);
  } finally {
    release.resolve();
    await settled;
  }
});
