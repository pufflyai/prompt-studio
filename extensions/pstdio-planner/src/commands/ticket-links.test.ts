import { expect, test } from "bun:test";
import type { ExtensionWorkspace, ResourceAnchor } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putAttempt } from "../data/attempt-storage";
import { createTicketWorkspaceLookup } from "../data/mappers";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { linkTicketCommand, unlinkTicketCommand } from "./ticket-links";
import { ticketWorkspacesCommand } from "./ticket-workspaces";

const setup = async () => {
  const storage = createMemoryStorage();
  const tickets = await Promise.all(
    ["One", "Two"].map((title) => createTicketCommand.run(...makeCommandArgs({ storage, params: { title } }))),
  );
  const workspace: ExtensionWorkspace = { id: "workspace", workspace_shorthand: "WS-1", anchors_json: [] };
  const session = { id: "session", title: "Session", status: "completed", anchors_json: [] as ResourceAnchor[] };
  const anchorsApi = (resource: { id: string; anchors_json?: ResourceAnchor[] }) => ({
    addAnchors: async (_id: string, anchors: ResourceAnchor[]) => {
      resource.anchors_json = [
        ...(resource.anchors_json ?? []).filter(
          (old) => !anchors.some((anchor) => anchor.type === old.type && anchor.id === old.id),
        ),
        ...anchors,
      ];
    },
    removeAnchors: async (_id: string, refs: { type: string; id: string }[]) => {
      resource.anchors_json = (resource.anchors_json ?? []).filter(
        (anchor) => !refs.some((ref) => ref.type === anchor.type && ref.id === anchor.id),
      );
    },
  });
  const overrides = {
    workspaces: {
      ...anchorsApi(workspace),
      list: async () => [workspace],
      get: async (id: string) => (id === workspace.id ? workspace : null),
      getByShorthand: async (id: string) => (id === "WS-1" ? workspace : null),
    },
    sessions: {
      ...anchorsApi(session),
      get: async (id: string) => (id === session.id ? session : null),
      listByWorkspace: async () => [],
    },
  };
  const args = (params: { id: string; workspace?: string; session?: string }) =>
    makeCommandArgs({ storage, params, overrides });
  return { storage, tickets, workspace, session, args };
};

for (const target of ["workspace", "session"] as const) {
  test(`links, refreshes and unlinks ${target} ticket anchors independently`, async () => {
    const env = await setup();
    const [one, two] = env.tickets;
    for (const ticket of [one, two, one]) {
      await linkTicketCommand.run(...env.args({ id: ticket.shorthand, [target]: target }));
    }
    expect(env[target].anchors_json).toHaveLength(2);
    expect(env[target].anchors_json).toContainEqual(
      expect.objectContaining({ id: one.id, shorthand: one.shorthand, role: "context" }),
    );
    if (target === "workspace") {
      for (const ticket of env.tickets) {
        expect(await ticketWorkspacesCommand.run(...env.args({ id: ticket.id }))).toHaveLength(1);
        expect(createTicketWorkspaceLookup([env.workspace]).get(ticket.shorthand)).toHaveLength(1);
      }
      await linkTicketCommand.run(...env.args({ id: one.id, workspace: "WS-1" }));
    }
    await unlinkTicketCommand.run(...env.args({ id: one.id, [target]: target }));
    await unlinkTicketCommand.run(...env.args({ id: one.id, [target]: target }));
    expect(env[target].anchors_json).toEqual([expect.objectContaining({ id: two.id })]);
  });
}

test("rejects invalid targets without changing anchors", async () => {
  const env = await setup();
  for (const command of [linkTicketCommand, unlinkTicketCommand]) {
    for (const target of [{}, { workspace: "workspace", session: "session" }]) {
      await expect(command.run(...env.args({ id: env.tickets[0].id, ...target }))).rejects.toThrow("Exactly one");
    }
    await expect(command.run(...env.args({ id: "missing", workspace: "workspace" }))).rejects.toThrow(
      'Unknown ticket "missing"',
    );
    await expect(command.run(...env.args({ id: env.tickets[0].id, workspace: "missing" }))).rejects.toThrow(
      'Unknown workspace "missing"',
    );
    await expect(command.run(...env.args({ id: env.tickets[0].id, session: "missing" }))).rejects.toThrow(
      'Unknown session "missing"',
    );
  }
  expect(env.workspace.anchors_json).toEqual([]);
  expect(env.session.anchors_json).toEqual([]);
});

for (const target of ["workspace", "implementation", "review"] as const) {
  test(`protects the managed attempt's ${target} link but allows other ticket links`, async () => {
    const env = await setup();
    const [one, two] = env.tickets;
    const now = new Date().toISOString();
    await putAttempt(env.storage, {
      schemaVersion: 1,
      workspaceId: "workspace",
      workspaceShorthand: "WS-1",
      ticketId: one.id,
      ticketShorthand: one.shorthand,
      implementationSessionId: target === "implementation" ? "session" : "implementation",
      state: "implementing",
      base: { workspaceId: null, headSha: "base" },
      implementationDisconnectRetries: 0,
      reviewDisconnectRetries: 0,
      blocker: null,
      createdAt: now,
      updatedAt: now,
      revisions: [
        {
          revision: 1,
          baseSha: "base",
          headSha: "head",
          changeRequestReportId: "report",
          submittedAt: now,
          submittedBy: { type: "agent", id: "agent", displayName: "Agent" },
          reviews: [
            {
              id: "review",
              sessionId: "session",
              reportId: null,
              reviewedHeadSha: "head",
              reviewer: { type: "agent", id: "reviewer", displayName: "Reviewer" },
              state: "started",
              verdict: null,
              startedAt: now,
              completedAt: null,
              supersedesReviewId: null,
            },
          ],
        },
      ],
    });
    const linkTarget = target === "workspace" ? { workspace: "workspace" } : { session: "session" };
    await linkTicketCommand.run(...env.args({ id: one.id, ...linkTarget }));
    await linkTicketCommand.run(...env.args({ id: two.id, ...linkTarget }));
    await expect(unlinkTicketCommand.run(...env.args({ id: one.id, ...linkTarget }))).rejects.toThrow(
      `belongs to the managed attempt for ${one.shorthand}`,
    );
    await unlinkTicketCommand.run(...env.args({ id: two.id, ...linkTarget }));
    expect(env[target === "workspace" ? "workspace" : "session"].anchors_json).toEqual([
      expect.objectContaining({ id: one.id }),
    ]);
  });
}
