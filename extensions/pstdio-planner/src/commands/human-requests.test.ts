import { describe, expect, test } from "bun:test";
import { humanRequestsCollection, putAttempt } from "../data/attempt-storage";
import { putTicket, tagsCollection, ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultTags } from "../data/seed";
import { makeCommandArgs } from "./command-context.fixture";
import { requestHumanCommand, resolveHumanRequestCommand } from "./human-requests";

const timestamp = "2026-08-18T09:00:00.000Z";

const setup = async () => {
  const storage = createMemoryStorage();
  await seedDefaultTags(storage);
  const flags = await tagsCollection(storage).get("default-human-requested");
  await tagsCollection(storage).put("default-human-requested", {
    ...flags!,
    name: "Interruptions",
    options: flags!.options.map((option) =>
      option.id === "default-human-requested-true" ? { ...option, name: "Needs a person" } : option,
    ),
  });
  await putTicket(storage, {
    id: "ticket-1",
    shorthand: "PS-1",
    title: "Human handoff",
    content: "# Human handoff",
    statusId: "in-review",
    tagIds: [],
    attachments: [],
    parentId: null,
    dependsOn: [],
    blockedReason: null,
    userPrompt: null,
    parallelizable: "yes",
    draft: false,
    archived: false,
    sortOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await putAttempt(storage, {
    schemaVersion: 1,
    workspaceId: "workspace-1",
    workspaceShorthand: "PS-1_A1",
    ticketId: "ticket-1",
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
  return storage;
};

describe("human request commands", () => {
  test("uses stable flag ids and creates one phase-other coordination session", async () => {
    const storage = await setup();
    const creates: Array<Record<string, unknown>> = [];
    const context = () =>
      makeCommandArgs({
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

    const first = await requestHumanCommand.run(...context());
    const second = await requestHumanCommand.run(...context());

    expect(second.id).toBe(first.id);
    expect(creates).toHaveLength(1);
    expect(creates[0]?.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "planner-human-request",
          metadata: expect.objectContaining({ phase: "other" }),
        }),
      ]),
    );
    expect((await ticketsCollection(storage).get("ticket-1"))?.tagIds).toContain("default-human-requested-true");
    expect(await humanRequestsCollection(storage).list()).toHaveLength(1);
  });

  test("does not reuse a related session without the matching attempt anchor", async () => {
    const storage = await setup();
    const creates: unknown[] = [];
    const followups: unknown[] = [];
    const result = await requestHumanCommand.run(
      ...makeCommandArgs({
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
      }),
    );

    expect(result).toMatchObject({ sessionId: "coordination-1", relatedSessionId: "unrelated-session" });
    expect(creates).toHaveLength(1);
    expect(followups).toEqual([]);
  });

  test("only an agent or human clears the flag after the last open request", async () => {
    const storage = await setup();
    const requestContext = (reason: "dependency-cycle" | "dependency-missing") =>
      makeCommandArgs({
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
    const first = await requestHumanCommand.run(...requestContext("dependency-cycle"));
    const second = await requestHumanCommand.run(...requestContext("dependency-missing"));
    const resolveContext = (requestId: string, source: "automation" | "cli") =>
      makeCommandArgs({
        storage,
        params: { requestId, resolution: "Chosen", completedAction: "Applied the choice" },
        overrides: { source, invocationId: "agent-1" },
      });

    await expect(resolveHumanRequestCommand.run(...resolveContext(first.id, "automation"))).rejects.toThrow(
      "Automation cannot resolve",
    );
    await resolveHumanRequestCommand.run(...resolveContext(first.id, "cli"));
    expect((await ticketsCollection(storage).get("ticket-1"))?.tagIds).toContain("default-human-requested-true");
    await resolveHumanRequestCommand.run(...resolveContext(second.id, "cli"));
    expect((await ticketsCollection(storage).get("ticket-1"))?.tagIds).not.toContain("default-human-requested-true");
  });
});
