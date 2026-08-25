import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { makeCommandContext } from "./command-context.fixture";
import { listInputRequestsCommand, requestInputCommand, resolveInputRequestCommand } from "./input-requests";
import { setupInputRequestTest } from "./input-requests.test-fixture";

describe("input request queries and resolution", () => {
  test("only an interactive command clears the flag after the last open request", async () => {
    const storage = await setupInputRequestTest();
    const requestContext = (reason: "dependency-cycle" | "dependency-missing") =>
      makeCommandContext({
        storage,
        params: {
          ticket: "PS-1",
          reason,
          question: reason,
          expectedAction: "Resolve it.",
          expectedTicketStatusId: "in-review",
        },
        overrides: {
          source: "schedule",
          sessions: {
            get: async () => null,
            create: async () => ({
              type: "session",
              id: `coordination-${reason}`,
              title: "Coordination",
              status: "in_progress",
            }),
          } as never,
        },
      });
    const first = await requestInputCommand.run(requestContext("dependency-cycle") as never);
    const second = await requestInputCommand.run(requestContext("dependency-missing") as never);
    const resolveContext = (requestId: string, source: "automation" | "cli") =>
      makeCommandContext({
        storage,
        params: { requestId, resolution: "Chosen", completedAction: "Applied the choice" },
        overrides: { source, invocationId: "agent-1" },
      });

    await expect(resolveInputRequestCommand.run(resolveContext(first.id, "automation") as never)).rejects.toThrow(
      "Automation cannot resolve",
    );
    await resolveInputRequestCommand.run(resolveContext(first.id, "cli") as never);
    expect((await ticketsCollection(storage).get("ticket-1"))?.tagIds).toContain("default-awaiting-input-true");
    await resolveInputRequestCommand.run(resolveContext(second.id, "cli") as never);
    expect((await ticketsCollection(storage).get("ticket-1"))?.tagIds).not.toContain("default-awaiting-input-true");
  });

  test("lists requests by ticket and state for CLI and agent callers", async () => {
    const storage = await setupInputRequestTest();
    const request = await requestInputCommand.run(
      makeCommandContext({
        storage,
        params: {
          ticket: "PS-1",
          reason: "dependency-missing",
          question: "Which ticket supplies the missing dependency?",
          expectedAction: "Add the missing dependency.",
          expectedTicketStatusId: "in-review",
        },
        overrides: {
          sessions: {
            get: async () => null,
            create: async () => ({ type: "session", id: "coordination-1", title: "Input", status: "in_progress" }),
          } as never,
        },
      }) as never,
    );

    const result = await listInputRequestsCommand.run(
      makeCommandContext({ storage, params: { ticket: "PS-1", state: "open" } }) as never,
    );

    expect(result).toEqual([
      {
        id: request.id,
        ticketId: "ticket-1",
        question: "Which ticket supplies the missing dependency?",
        expectedAction: "Add the missing dependency.",
        state: "open",
        sessionId: "coordination-1",
        relatedSessionId: null,
        workspaceId: null,
        revision: null,
      },
    ]);
  });

  test("resolving a request closes its notification and refreshes ticket views", async () => {
    const storage = await setupInputRequestTest();
    const request = await requestInputCommand.run(
      makeCommandContext({
        storage,
        params: {
          ticket: "PS-1",
          reason: "dependency-cycle",
          question: "Which edge should be removed?",
          expectedAction: "Repair the cycle.",
          expectedTicketStatusId: "in-review",
        },
        overrides: {
          sessions: {
            get: async () => null,
            create: async () => ({ type: "session", id: "coordination-1", title: "Input", status: "in_progress" }),
          } as never,
        },
      }) as never,
    );
    const resolvedNotifications: unknown[] = [];
    const events: unknown[] = [];

    await resolveInputRequestCommand.run(
      makeCommandContext({
        storage,
        params: { requestId: request.id, resolution: "Remove PS-2", completedAction: "Updated dependencies" },
        overrides: {
          source: "cli",
          notify: {
            resolve: async (input: unknown) => {
              resolvedNotifications.push(input);
              return [];
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

    expect(resolvedNotifications).toEqual([
      { dedupeKey: `pstdio-planner:input-request:${request.id}`, status: "done" },
    ]);
    expect(events).toEqual([expect.objectContaining({ payload: { ticketId: "ticket-1" } })]);
  });
});
