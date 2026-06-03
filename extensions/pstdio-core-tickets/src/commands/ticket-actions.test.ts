import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { breakIntoSubTicketsCommand, refineTicketCommand, runAttemptCommand } from "./ticket-actions";

describe("runAttemptCommand", () => {
  test("creates an attempt from a data-renderer row action", async () => {
    const attempts: unknown[] = [];

    await runAttemptCommand.run(
      makeCommandContext({
        storage: createMemoryStorage(),
        params: { rowId: "ticket-1" },
        overrides: {
          tickets: {
            createAttempt: async (input: unknown) => {
              attempts.push(input);
              return { id: "attempt-1" };
            },
          } as never,
        },
      }),
    );

    expect(attempts).toEqual([
      {
        ticket: "ticket-1",
        prompt: "Implement ticket: ticket-1",
      },
    ]);
  });

  test("preserves explicit agent and repo params", async () => {
    const attempts: unknown[] = [];

    await runAttemptCommand.run(
      makeCommandContext({
        storage: createMemoryStorage(),
        params: {
          ticket: "PS-304",
          agent: { harnessId: "codex", model: "gpt-5" },
          repo: { repoId: "repo-1", branch: "main" },
        },
        overrides: {
          tickets: {
            createAttempt: async (input: unknown) => {
              attempts.push(input);
              return { id: "attempt-1" };
            },
          } as never,
        },
      }),
    );

    expect(attempts).toEqual([
      {
        ticket: "PS-304",
        agent: "codex",
        model: "gpt-5",
        repoId: "repo-1",
        branch: "main",
        prompt: "Implement ticket: PS-304",
      },
    ]);
  });
});

describe("refineTicketCommand", () => {
  test("starts a refinement session for the active ticket resource", async () => {
    const sessions: unknown[] = [];

    await refineTicketCommand.run(
      makeCommandContext({
        storage: createMemoryStorage(),
        params: { context: "Tighten the acceptance criteria." },
        overrides: {
          resource: { type: "ticket", id: "PS-304" },
          sessions: {
            create: async (input: unknown) => {
              sessions.push(input);
              return { id: "session-1" };
            },
          } as never,
        },
      }),
    );

    expect(sessions).toEqual([
      {
        title: "Refine ticket: PS-304",
        template: "refine-ticket",
        vars: {
          ticket: "PS-304",
          additionalContext: "Tighten the acceptance criteria.",
        },
      },
    ]);
  });
});

describe("breakIntoSubTicketsCommand", () => {
  test("starts a breakdown session from a row action", async () => {
    const sessions: unknown[] = [];

    await breakIntoSubTicketsCommand.run(
      makeCommandContext({
        storage: createMemoryStorage(),
        params: {
          rowId: "ticket-1",
          agent: { harnessId: "codex", model: "gpt-5" },
          template: "ticket",
        },
        overrides: {
          sessions: {
            create: async (input: unknown) => {
              sessions.push(input);
              return { id: "session-1" };
            },
          } as never,
        },
      }),
    );

    expect(sessions).toEqual([
      {
        title: "Break into sub-tickets: ticket-1",
        harness: { harnessId: "codex", model: "gpt-5" },
        template: "create-sub-tickets",
        vars: {
          ticket: "ticket-1",
          templateName: "ticket",
        },
      },
    ]);
  });
});
