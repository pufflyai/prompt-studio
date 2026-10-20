import { putTicket, ticketsCollection } from "../data/ticket-context.fixture";
import { describe, expect, test } from "bun:test";
import type { CommandSource } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putAttempt, readAttempt } from "../data/attempt-storage";

import { hasPendingImplementationInput } from "../data/implementation-input";
import {
  hasPendingInput,
  listTicketReviewRequests,
  REVIEW_OUTCOMES_COLLECTION,
  reviewRequestsCollection,
} from "../data/review-request-storage";
import { reviewRequestCleanupHook } from "../hooks/review-request-cleanup";
import { makeCommandContext } from "./command-context.fixture";
import {
  cancelReviewRequestCommand,
  listReviewRequestsCommand,
  openReviewRequestCommand,
  readReviewRequestCommand,
  requestHumanCommand,
  reviewCommand,
} from "./review-requests";

const timestamp = "2026-08-18T09:00:00.000Z";

const ticket = (id: string, statusId = "in-review") => ({
  id,
  shorthand: id.toUpperCase(),
  title: "Human handoff",
  content: "# Human handoff",
  statusId,
  tagIds: [],
  attachments: [],
  parentId: null,
  dependsOn: [],
  blockedReason: null,
  userPrompt: null,
  draft: false,
  archived: false,
  sortOrder: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const setup = async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, ticket("ps-1"));
  const created: Array<{ id: string; title: string; prompt?: string; anchors?: unknown[] }> = [];
  const opened: unknown[] = [];
  const followups: unknown[] = [];
  const context = (source: CommandSource = "cli", extra: Record<string, unknown> = {}) =>
    makeCommandContext({
      storage,
      params: {},
      overrides: {
        source,
        invocationId: `${source}-actor`,
        navigation: { open: (target: unknown) => opened.push(target) },
        sessions: {
          get: async (id: string) => {
            const session = created.find((session) => session.id === id);
            return session ? { ...session, anchors_json: session.anchors } : null;
          },
          create: async (input: { title: string; prompt?: string; anchors?: unknown[] }) => {
            const session = { ...input, id: `session-${created.length + 1}` };
            created.push(session);
            return { type: "session", status: "in_progress", ...session };
          },
          addAnchors: async () => {},
          followup: async (input: unknown) => {
            followups.push(input);
          },
        } as never,
        ...extra,
      },
    });
  const inputPending = async () => hasPendingInput(await listTicketReviewRequests(storage, "ps-1"));
  return { storage, created, opened, followups, context, inputPending };
};

const task = {
  ticket: "PS-1",
  title: "Check the preview",
  instructions: "Confirm its layout.",
  request: { kind: "task" },
};
const decision = {
  ticket: "PS-1",
  title: "Choose the release scope",
  instructions: "Choose the scope and describe any limits.",
  request: {
    kind: "decision",
    questions: [
      {
        id: "scope",
        label: "Release scope",
        required: true,
        input: {
          kind: "single-choice",
          options: [
            { id: "preview", label: "Preview" },
            { id: "full", label: "Full release" },
          ],
        },
      },
      {
        id: "platforms",
        label: "Platforms",
        required: false,
        input: {
          kind: "multiple-choice",
          options: [
            { id: "mac", label: "macOS" },
            { id: "win", label: "Windows" },
          ],
        },
      },
      { id: "limits", label: "Limits", required: true, input: { kind: "text" } },
    ],
  },
};

describe("review requests", () => {
  test("a fresh project creates and answers a task without starting a session", async () => {
    const { storage, created, context, inputPending } = await setup();

    const request = await requestHumanCommand.run(context(), task as never);

    expect(request).toMatchObject({
      state: "open",
      requestedBy: { type: "agent" },
      context: { sessionId: null },
    });
    expect(created).toHaveLength(0);
    expect(await inputPending()).toBe(true);

    await reviewCommand.run(context("dashboard"), { requestId: request.id, response: { confirmed: true } });

    const reloaded = await readReviewRequestCommand.run(makeCommandContext({ storage, params: {} }), {
      requestId: request.id,
    });
    expect(reloaded).toMatchObject({
      state: "answered",
      outcome: { kind: "answered", by: { type: "human" }, response: { confirmed: true } },
      outcomeText: "Completion confirmed",
    });
    expect(await inputPending()).toBe(false);
    expect(created).toHaveLength(0);
  });

  test("decisions validate every question kind before saving the answer", async () => {
    const { context } = await setup();
    const request = await requestHumanCommand.run(context(), decision as never);
    const answer = (answers: Record<string, unknown>) =>
      reviewCommand.run(context(), { requestId: request.id, response: { answers } as never });

    await expect(answer({ scope: "preview" })).rejects.toThrow("Limits is required.");
    await expect(answer({ scope: "beta", limits: "None" })).rejects.toThrow("Invalid choice for Release scope.");
    await expect(answer({ scope: ["preview"], limits: "None" })).rejects.toThrow("Invalid choices for Release scope.");
    await expect(answer({ scope: "full", platforms: ["mac", "mac"], limits: "None" })).rejects.toThrow("Duplicate");
    await expect(answer({ scope: "full", extra: "x", limits: "None" })).rejects.toThrow('Unknown question "extra"');
    expect((await readReviewRequestCommand.run(context(), { requestId: request.id })).state).toBe("open");

    const saved = await answer({ scope: "preview", platforms: ["mac", "win"], limits: "Internal project first." });
    expect(saved.outcomeText).toBe(
      "Release scope: Preview\nPlatforms: macOS, Windows\nLimits: Internal project first.",
    );
  });

  test("input stays pending until the last open request is answered or cancelled", async () => {
    const { context, inputPending } = await setup();
    const first = await requestHumanCommand.run(context(), task as never);
    const second = await requestHumanCommand.run(context(), decision as never);

    await reviewCommand.run(context(), { requestId: first.id, response: { confirmed: true } });
    expect(await inputPending()).toBe(true);
    const open = await listReviewRequestsCommand.run(context(), { ticket: "PS-1", openOnly: true });
    expect(open.requests.map(({ id }) => id)).toEqual([second.id]);

    await cancelReviewRequestCommand.run(context(), { requestId: second.id, reason: "The scope changed." });
    expect(await inputPending()).toBe(false);
    expect((await listReviewRequestsCommand.run(context(), { ticket: "PS-1" })).requests).toHaveLength(2);
  });

  test("a saved decision can be revised without hiding other pending input", async () => {
    const { context, inputPending } = await setup();
    const request = await requestHumanCommand.run(context(), decision as never);
    const answer = (answers: Record<string, string | string[]>) =>
      reviewCommand.run(context("dashboard"), { requestId: request.id, response: { answers } });
    await answer({ scope: "preview", platforms: ["mac"], limits: "Internal only" });
    expect(await inputPending()).toBe(false);
    const pending = await requestHumanCommand.run(context(), task as never);

    await expect(answer({ scope: "beta", limits: "None" })).rejects.toThrow("Invalid choice");
    expect((await readReviewRequestCommand.run(context(), { requestId: request.id })).outcome).toMatchObject({
      response: { answers: { scope: "preview", platforms: ["mac"], limits: "Internal only" } },
    });
    await answer({ scope: "full", platforms: ["win"], limits: "Public release" });

    const reloaded = await readReviewRequestCommand.run(context(), { requestId: request.id });
    expect(reloaded).toMatchObject({
      state: "answered",
      outcome: {
        by: { type: "human" },
        response: { answers: { scope: "full", platforms: ["win"], limits: "Public release" } },
      },
      outcomeText: "Release scope: Full release\nPlatforms: Windows\nLimits: Public release",
    });
    expect(await inputPending()).toBe(true);
    expect(
      (await listReviewRequestsCommand.run(context(), { ticket: "PS-1", openOnly: true })).requests.map(({ id }) => id),
    ).toEqual([pending.id]);
  });

  test("cancelled decisions cannot be answered", async () => {
    const { context } = await setup();
    const request = await requestHumanCommand.run(context(), decision as never);
    await cancelReviewRequestCommand.run(context(), { requestId: request.id, reason: "Withdrawn" });
    await expect(
      reviewCommand.run(context(), {
        requestId: request.id,
        response: { answers: { scope: "full", limits: "None" } },
      }),
    ).rejects.toThrow("already cancelled");
  });

  test("schedules, automations, and events cannot answer or cancel a request", async () => {
    const { context } = await setup();
    const request = await requestHumanCommand.run(context("schedule"), task as never);

    for (const source of ["schedule", "automation", "event"] as const) {
      await expect(
        reviewCommand.run(context(source), { requestId: request.id, response: { confirmed: true } }),
      ).rejects.toThrow("Automation cannot answer");
      await expect(
        cancelReviewRequestCommand.run(context(source), { requestId: request.id, reason: "No" }),
      ).rejects.toThrow("Automation cannot cancel");
    }
    expect(request.requestedBy.type).toBe("automation");
  });

  test("competing answers and cancellations store exactly one outcome", async () => {
    const { context } = await setup();
    const request = await requestHumanCommand.run(context(), task as never);

    const results = await Promise.allSettled([
      reviewCommand.run(context(), { requestId: request.id, response: { confirmed: true } }),
      cancelReviewRequestCommand.run(context(), { requestId: request.id, reason: "Withdrawn" }),
      reviewCommand.run(context("dashboard"), { requestId: request.id, response: { confirmed: true } }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const current = await readReviewRequestCommand.run(context(), { requestId: request.id });
    await expect(
      reviewCommand.run(context(), { requestId: request.id, response: { confirmed: true } }),
    ).rejects.toThrow(`Request ${request.id} is already ${current.state}.`);
  });
});

describe("review request conversations", () => {
  test("opening a request starts its conversation once and records no response", async () => {
    const { context, opened, created } = await setup();
    const request = await requestHumanCommand.run(context(), task as never);

    expect(await openReviewRequestCommand.run(context("dashboard"), { requestId: request.id })).toMatchObject({
      id: "session-1",
    });
    expect(created).toHaveLength(1);
    expect(created[0]?.prompt).toContain(`pst pstdio-planner review --request-id ${request.id}`);
    expect(created[0]?.anchors).toContainEqual(
      expect.objectContaining({ type: "planner-human-request", id: request.id, extensionId: "pstdio-planner" }),
    );
    await openReviewRequestCommand.run(context("dashboard"), { requestId: request.id });
    expect(created).toHaveLength(1);
    expect(opened).toHaveLength(2);
    expect((await readReviewRequestCommand.run(context(), { requestId: request.id })).state).toBe("open");
  });

  test("a related ticket session stays idle until the person opens the request", async () => {
    const { context, created, followups } = await setup();
    created.push({ id: "origin", title: "Planning", anchors: [{ type: "ticket", id: "ps-1" }] });
    const request = await requestHumanCommand.run(context(), { ...task, sessionId: "origin" } as never);

    expect(created).toHaveLength(1);
    expect(followups).toEqual([]);
    expect(request.context).toMatchObject({ sessionId: null, relatedSessionId: "origin" });

    await openReviewRequestCommand.run(context("dashboard"), { requestId: request.id });
    await openReviewRequestCommand.run(context("dashboard"), { requestId: request.id });

    expect(created).toHaveLength(1);
    expect(followups).toEqual([expect.objectContaining({ sessionId: "origin" })]);
    expect((await readReviewRequestCommand.run(context(), { requestId: request.id })).context.sessionId).toBe("origin");
  });

  test("overlapping opens share one conversation", async () => {
    const { context, created } = await setup();
    const request = await requestHumanCommand.run(context(), task as never);
    const sessions = await Promise.all([
      openReviewRequestCommand.run(context("dashboard"), { requestId: request.id }),
      openReviewRequestCommand.run(context("dashboard"), { requestId: request.id }),
    ]);

    expect(created).toHaveLength(1);
    expect(sessions[0]?.id).toBe(sessions[1]?.id);
  });

  test("opening a saved decision preserves its answer", async () => {
    const { context, created } = await setup();
    const request = await requestHumanCommand.run(context(), decision as never);
    const answered = await reviewCommand.run(context("dashboard"), {
      requestId: request.id,
      response: { answers: { scope: "preview", limits: "Internal release" } },
    });
    expect(created).toHaveLength(0);

    await openReviewRequestCommand.run(context("dashboard"), { requestId: request.id });

    const reopened = await readReviewRequestCommand.run(context(), { requestId: request.id });
    expect(reopened.outcome).toEqual(answered.outcome);
    expect(reopened.state).toBe("answered");
    expect(created).toHaveLength(1);
  });
});

describe("review request ownership", () => {
  test("a request opened before the ticket was done can still be settled", async () => {
    const { storage, context, inputPending } = await setup();
    const request = await requestHumanCommand.run(context(), task as never);
    await putTicket(storage, { ...ticket("ps-1"), statusId: "done", tagIds: [] });

    await expect(requestHumanCommand.run(context(), task as never)).rejects.toThrow("The ticket is complete.");
    await reviewCommand.run(context(), { requestId: request.id, response: { confirmed: true } });

    expect((await readReviewRequestCommand.run(context(), { requestId: request.id })).state).toBe("answered");
    expect(await inputPending()).toBe(false);
  });

  test("an answer that races ticket deletion leaves no records behind", async () => {
    const { storage, context } = await setup();
    const request = await requestHumanCommand.run(context(), task as never);
    const outcomes = storage.collection(REVIEW_OUTCOMES_COLLECTION);
    const insert = outcomes.createIfAbsent.bind(outcomes);
    const racing = Object.create(storage, {
      collection: {
        value: (name: string) => {
          const collection = storage.collection(name);
          if (name !== REVIEW_OUTCOMES_COLLECTION) return collection;
          // Ticket deletion and its cleanup finish just before the outcome insert.
          return Object.assign(Object.create(collection), {
            createIfAbsent: async (id: string, value: unknown) => {
              await ticketsCollection(storage).delete("ps-1");
              await reviewRequestCleanupHook.run(context("event") as never, { ticketId: "ps-1" });
              return insert(id, value);
            },
          });
        },
      },
    });

    await expect(
      reviewCommand.run(context("cli", { storage: racing }), { requestId: request.id, response: { confirmed: true } }),
    ).rejects.toThrow("The ticket was removed.");
    expect(await outcomes.list()).toEqual([]);
    expect(await reviewRequestsCollection(storage).list()).toEqual([]);
  });

  test("deleting a ticket removes its requests", async () => {
    const { storage, context } = await setup();
    const request = await requestHumanCommand.run(context(), task as never);
    await ticketsCollection(storage).delete("ps-1");

    await reviewRequestCleanupHook.run(context("event") as never, { ticketId: "ps-1" });

    expect(await reviewRequestsCollection(storage).get(request.id)).toBeUndefined();
    await expect(
      reviewCommand.run(context(), { requestId: request.id, response: { confirmed: true } }),
    ).rejects.toThrow("Unknown review request");
  });
});

describe("attempt handoffs", () => {
  const setupAttempt = async () => {
    const fixture = await setup();
    await putAttempt(fixture.storage, {
      schemaVersion: 2,
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-1_A1",
      ticketId: "ps-1",
      ticketShorthand: "PS-1",
      implementationSessionId: "implementation-1",

      base: { workspaceId: null, headSha: "base-sha" },
      revisions: [
        {
          revision: 1,
          baseSha: "base-sha",
          headSha: "head-sha",
          changeRequestReportId: "change-report-1",
          submittedAt: timestamp,
          submittedBy: { type: "agent", id: "agent-1", displayName: "Agent" },
          reviews: [],
        },
      ],
      implementationDisconnectRetries: 0,
      reviewDisconnectRetries: 0,
      blocker: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return fixture;
  };
  const handoff = {
    ticket: "PS-1",
    reason: "approved-revision",
    workspaceId: "workspace-1",
    revision: 1,
    sessionId: "unrelated-session",
    title: "PS-1_A1 revision 1 is approved.",
    instructions: "Merge or reject it.",
    request: {
      kind: "decision",
      questions: [{ id: "result", label: "Result", required: true, input: { kind: "text" } }],
    },
    expectedTicketStatusId: "in-review",
    expectedAttemptState: "approved",
  };

  test("a retried handoff reuses its open request and does not reuse an unrelated session", async () => {
    const { context, created, inputPending } = await setupAttempt();

    const first = await requestHumanCommand.run(context("automation"), handoff as never);
    const second = await requestHumanCommand.run(context("automation"), handoff as never);

    expect(second.id).toBe(first.id);
    expect(created).toHaveLength(0);
    expect(first.context).toEqual({
      reason: "approved-revision",
      workspaceId: "workspace-1",
      attemptRevision: 1,
      sessionId: null,
      relatedSessionId: "unrelated-session",
    });
    expect(await inputPending()).toBe(true);
  });

  test("a changed revision refuses the handoff before writing", async () => {
    const { context, created } = await setupAttempt();

    await expect(requestHumanCommand.run(context("automation"), { ...handoff, revision: 2 } as never)).rejects.toThrow(
      "Attempt revision changed",
    );
    expect(created).toHaveLength(0);
  });

  test("human requests preserve the chosen ticket status when a variant records evidence", async () => {
    const { storage, context } = await setupAttempt();
    await requestHumanCommand.run(context("automation"), handoff as never);
    await putTicket(storage, { ...ticket("ps-1"), tagIds: [] });
    const attempt = (await readAttempt(storage, "workspace-1"))!;
    await putAttempt(storage, { ...attempt, updatedAt: new Date().toISOString() });

    expect((await ticketsCollection(storage).get("ps-1"))?.statusId).toBe("in-review");
  });
});

test("persisted merge-only requests do not block implementation", async () => {
  const { storage, context } = await setup();
  await requestHumanCommand.run(context(), { ...task, request: { kind: "task" }, affectedAction: "merge" } as const);
  const requests = await listTicketReviewRequests(storage, "ps-1");
  expect(requests.requests[0]!.context.affectedAction).toBe("merge");
  expect(hasPendingImplementationInput(requests)).toBe(false);
  expect(hasPendingImplementationInput(requests, true)).toBe(true);
});
