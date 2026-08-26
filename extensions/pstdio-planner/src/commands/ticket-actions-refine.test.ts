import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { refineTicketCommand } from "./ticket-actions";

const createSessionResource = () => ({
  type: "session" as const,
  id: "session-1",
  title: "Session",
  status: "in_progress" as const,
});

describe("refineTicketCommand", () => {
  test("starts a refinement session for the active ticket resource", async () => {
    const sessions: unknown[] = [];

    await refineTicketCommand.run(
      ...makeCommandArgs({
        storage: createMemoryStorage(),
        params: { context: "Tighten the acceptance criteria." },
        overrides: {
          resource: { type: "ticket", id: "PS-304" },
          sessions: {
            create: async (input: unknown) => {
              sessions.push(input);
              return createSessionResource();
            },
          } as never,
        },
      }),
    );

    expect(sessions).toEqual([
      {
        title: "Refine ticket: PS-304",
        anchors: [
          {
            type: "ticket",
            id: "PS-304",
            projectId: "proj-1",
            extensionId: "pstdio-planner",
            label: "PS-304",
            role: "primary",
            metadata: { shorthand: "PS-304" },
          },
        ],
        template: "refine-ticket",
        vars: {
          ticket: "PS-304",
          additionalContext: "Tighten the acceptance criteria.",
        },
      },
    ]);
  });

  test("uses the ticket shorthand when setup receives a stored ticket id", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
    const sessions: unknown[] = [];

    await refineTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: {
          ticket: ticket.id,
          agent: { harnessId: "codex", model: "gpt-5" },
          template: "bug_fix",
          context: "Tighten the acceptance criteria.",
        },
        overrides: {
          sessions: {
            create: async (input: unknown) => {
              sessions.push(input);
              return createSessionResource();
            },
          } as never,
        },
      }),
    );

    expect(sessions).toEqual([
      {
        title: "Refine ticket: T-1",
        anchors: [
          {
            type: "ticket",
            id: ticket.id,
            projectId: "proj-1",
            extensionId: "pstdio-planner",
            label: "T-1",
            role: "primary",
            metadata: {
              shorthand: "T-1",
              resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
            },
          },
        ],
        harness: { harnessId: "codex", model: "gpt-5" },
        template: "refine-ticket",
        vars: {
          ticket: "T-1",
          templateName: "bug_fix",
          additionalContext: "Tighten the acceptance criteria.",
        },
      },
    ]);
  });
});
