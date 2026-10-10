import { describe, expect, test } from "bun:test";
import type { CommandSource } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { rollUpAttemptTicket } from "../data/attempt-rollup";
import { putAttempt, readAttempt } from "../data/attempt-storage";
import { putTicket, tagsCollection, ticketsCollection } from "../data/collections";
import { REVIEW_OUTCOMES_COLLECTION, reviewRequestsCollection } from "../data/review-request-storage";
import { seedDefaultTags } from "../data/seed";
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
const FLAG = "default-human-requested-true";

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
  const context = (source: CommandSource = "cli", extra: Record<string, unknown> = {}) =>
    makeCommandContext({
      storage,
      params: {},
      overrides: {
        source,
        invocationId: `${source}-actor`,
        navigation: { open: (target: unknown) => opened.push(target) },
        sessions: {
          get: async (id: string) => created.find((session) => session.id === id) ?? null,
          create: async (input: { title: string; prompt?: string; anchors?: unknown[] }) => {
            const session = { ...input, id: `session-${created.length + 1}` };
            created.push(session);
            return { type: "session", status: "in_progress", ...session };
          },
          addAnchors: async () => {},
          followup: async () => {},
        } as never,
        ...extra,
      },
    });
  const flagged = async () => (await ticketsCollection(storage).get("ps-1"))?.tagIds?.includes(FLAG);
  return { storage, created, opened, context, flagged };
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
  test("a fresh project creates, answers, and reloads a task with its session and flag", async () => {
    const { storage, created, context, flagged } = await setup();

    const request = await requestHumanCommand.run(context(), task as never);

    expect(request).toMatchObject({
      state: "open",
      requestedBy: { type: "agent" },
      context: { sessionId: "session-1" },
    });
    expect(created[0]?.prompt).toContain(`pst pstdio-planner review --request-id ${request.id}`);
    expect(created[0]?.anchors).toContainEqual(
      expect.objectContaining({ type: "planner-human-request", id: request.id, extensionId: "pstdio-planner" }),
    );
    expect(await flagged()).toBe(true);

    await reviewCommand.run(context("dashboard"), { requestId: request.id, response: { confirmed: true } });

    const reloaded = await readReviewRequestCommand.run(makeCommandContext({ storage, params: {} }), {
      requestId: request.id,
    });
    expect(reloaded).toMatchObject({
      state: "answered",
      outcome: { kind: "answered", by: { type: "human" }, response: { confirmed: true } },
      outcomeText: "Completion confirmed",
    });
    expect(await flagged()).toBe(false);
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

  test("Review Needed stays until the last open request is answered or cancelled", async () => {
    const { context, flagged } = await setup();
    const first = await requestHumanCommand.run(context(), task as never);
    const second = await requestHumanCommand.run(context(), decision as never);

    await reviewCommand.run(context(), { requestId: first.id, response: { confirmed: true } });
    expect(await flagged()).toBe(true);
    const open = await listReviewRequestsCommand.run(context(), { ticket: "PS-1", openOnly: true });
    expect(open.requests.map(({ id }) => id)).toEqual([second.id]);

    await cancelReviewRequestCommand.run(context(), { requestId: second.id, reason: "The scope changed." });
    expect(await flagged()).toBe(false);
    expect((await listReviewRequestsCommand.run(context(), { ticket: "PS-1" })).requests).toHaveLength(2);
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

  test("opening the linked chat records no response", async () => {
    const { context, opened } = await setup();
    const request = await requestHumanCommand.run(context(), task as never);

    expect(await openReviewRequestCommand.run(context("dashboard"), { requestId: request.id })).toMatchObject({
      id: "session-1",
    });
    expect(opened).toHaveLength(1);
    expect((await readReviewRequestCommand.run(context(), { requestId: request.id })).state).toBe("open");
  });

  test("a request opened before the ticket was done can still be settled", async () => {
    const { storage, context, flagged } = await setup();
    const request = await requestHumanCommand.run(context(), task as never);
    await putTicket(storage, { ...ticket("ps-1"), statusId: "done", tagIds: [FLAG] });

    await expect(requestHumanCommand.run(context(), task as never)).rejects.toThrow("The ticket is complete.");
    await reviewCommand.run(context(), { requestId: request.id, response: { confirmed: true } });

    expect((await readReviewRequestCommand.run(context(), { requestId: request.id })).state).toBe("answered");
    expect(await flagged()).toBe(false);
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
    await seedDefaultTags(fixture.storage);
    const flags = await tagsCollection(fixture.storage).get("default-human-requested");
    await tagsCollection(fixture.storage).put("default-human-requested", { ...flags!, name: "Interruptions" });
    await putAttempt(fixture.storage, {
      schemaVersion: 1,
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-1_A1",
      ticketId: "ps-1",
      ticketShorthand: "PS-1",
      implementationSessionId: "implementation-1",
      state: "approved",
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
    const { context, created, flagged } = await setupAttempt();

    const first = await requestHumanCommand.run(context("automation"), handoff as never);
    const second = await requestHumanCommand.run(context("automation"), handoff as never);

    expect(second.id).toBe(first.id);
    expect(created).toHaveLength(1);
    expect(first.context).toEqual({
      reason: "approved-revision",
      workspaceId: "workspace-1",
      attemptRevision: 1,
      sessionId: "session-1",
      relatedSessionId: "unrelated-session",
    });
    expect(await flagged()).toBe(true);
  });

  test("a changed attempt refuses the handoff before writing", async () => {
    const { context, created } = await setupAttempt();

    await expect(
      requestHumanCommand.run(context("automation"), { ...handoff, expectedAttemptState: "blocked" } as never),
    ).rejects.toThrow("Attempt state changed");
    expect(created).toHaveLength(0);
  });

  test("an open request pauses attempt status updates even when its flag write was lost", async () => {
    const { storage, context } = await setupAttempt();
    await requestHumanCommand.run(context("automation"), handoff as never);
    await putTicket(storage, { ...ticket("ps-1"), tagIds: [] });
    const attempt = (await readAttempt(storage, "workspace-1"))!;
    await putAttempt(storage, { ...attempt, state: "implementing" });

    await rollUpAttemptTicket(storage, "ps-1");

    expect((await ticketsCollection(storage).get("ps-1"))?.statusId).toBe("in-review");
  });
});
