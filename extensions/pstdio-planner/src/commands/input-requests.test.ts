import { describe, expect, test } from "bun:test";
import { inputRequestsCollection } from "../data/attempt-storage";
import { ticketsCollection } from "../data/collections";
import { makeCommandContext } from "./command-context.fixture";
import { requestInputCommand } from "./input-requests";
import { setupInputRequestTest } from "./input-requests.test-fixture";

describe("input request commands", () => {
  test("reuses the completed refinement session without starting or following up an agent", async () => {
    const storage = await setupInputRequestTest();
    const ticket = await ticketsCollection(storage).get("ticket-1");
    await ticketsCollection(storage).put("ticket-1", { ...ticket!, statusId: "ready" });
    const addedAnchors: unknown[] = [];
    const creates: unknown[] = [];
    const followups: unknown[] = [];
    const notifications: unknown[] = [];
    const events: unknown[] = [];

    const result = await requestInputCommand.run(
      makeCommandContext({
        storage,
        params: {
          ticket: "PS-1",
          sessionId: "refinement-1",
          reason: "refinement-ready",
          question: "PS-1 finished refinement and is ready to read.",
          expectedAction: "Read the refined ticket, then resolve this input request.",
          expectedTicketStatusId: "ready",
        },
        overrides: {
          source: "automation",
          sessions: {
            get: async () => ({
              id: "refinement-1",
              title: "Refine PS-1",
              status: "completed",
              anchors_json: [{ type: "ticket", id: "ticket-1" }],
            }),
            addAnchors: async (_sessionId: string, anchors: unknown[]) => {
              addedAnchors.push(...anchors);
            },
            create: async (input: unknown) => {
              creates.push(input);
              return { type: "session", id: "unexpected", title: "Unexpected", status: "in_progress" };
            },
            followup: async (input: unknown) => {
              followups.push(input);
            },
          } as never,
          notify: {
            action: async (input: unknown) => {
              notifications.push(input);
              return {};
            },
          } as never,
          events: {
            emit: async (event: unknown, payload: unknown) => {
              events.push({ event, payload });
              return { delivered: 1 };
            },
          } as never,
        },
      }) as never,
    );

    expect(result).toMatchObject({ sessionId: "refinement-1", relatedSessionId: "refinement-1" });
    expect(addedAnchors).toEqual([expect.objectContaining({ type: "planner-input-request", id: result.id })]);
    expect(creates).toEqual([]);
    expect(followups).toEqual([]);
    expect(notifications).toEqual([
      expect.objectContaining({
        title: "Awaiting input: PS-1",
        body: "PS-1 finished refinement and is ready to read.",
        kind: "blocked",
        priority: "high",
        actions: [
          expect.objectContaining({ id: "open-session", primary: true }),
          expect.objectContaining({ id: "open-ticket" }),
        ],
      }),
    ]);
    expect(events).toEqual([expect.objectContaining({ payload: { ticketId: "ticket-1" } })]);
  });

  test("uses stable flag ids and creates one phase-other coordination session", async () => {
    const storage = await setupInputRequestTest();
    const creates: Array<Record<string, unknown>> = [];
    const context = () =>
      makeCommandContext({
        storage,
        params: {
          ticket: "PS-1",
          reason: "dependency-cycle",
          question: "Which dependency should change?",
          expectedAction: "Repair the dependency graph.",
          expectedTicketStatusId: "in-review",
        },
        overrides: {
          source: "schedule",
          sessions: {
            get: async () => null,
            create: async (input: Record<string, unknown>) => {
              creates.push(input);
              return { type: "session", id: "coordination-1", title: "Coordination", status: "in_progress" };
            },
          } as never,
        },
      });

    const first = await requestInputCommand.run(context() as never);
    const second = await requestInputCommand.run(context() as never);

    expect(second.id).toBe(first.id);
    expect(creates).toHaveLength(1);
    expect(creates[0]?.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "planner-input-request",
          metadata: expect.objectContaining({ phase: "other" }),
        }),
      ]),
    );
    expect((await ticketsCollection(storage).get("ticket-1"))?.tagIds).toContain("default-awaiting-input-true");
    expect(await inputRequestsCollection(storage).list()).toHaveLength(1);
  });

  test("does not reuse a related session without the matching attempt anchor", async () => {
    const storage = await setupInputRequestTest();
    const creates: unknown[] = [];
    const followups: unknown[] = [];
    const result = await requestInputCommand.run(
      makeCommandContext({
        storage,
        params: {
          ticket: "PS-1",
          workspaceId: "workspace-1",
          revision: 1,
          sessionId: "unrelated-session",
          reason: "approved-revision",
          question: "Merge this revision?",
          expectedAction: "Merge or reject it.",
          expectedTicketStatusId: "in-review",
          expectedAttemptState: "approved",
        },
        overrides: {
          source: "automation",
          sessions: {
            get: async () => ({
              id: "unrelated-session",
              title: "Unrelated",
              status: "completed",
              anchors_json: [{ type: "ticket", id: "another-ticket" }],
            }),
            create: async (input: unknown) => {
              creates.push(input);
              return { type: "session", id: "coordination-1", title: "Coordination", status: "in_progress" };
            },
            followup: async (input: unknown) => {
              followups.push(input);
            },
          } as never,
        },
      }) as never,
    );

    expect(result).toMatchObject({ sessionId: "coordination-1", relatedSessionId: "unrelated-session" });
    expect(creates).toHaveLength(1);
    expect(followups).toEqual([]);
  });
});
