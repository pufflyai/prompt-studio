import { expect, test } from "bun:test";
import { putTicket, statusesCollection } from "../data/collections";
import { fixture } from "./auto-build.fixture";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { nextTicketsCommand } from "./next-tickets";
import { createSessionResource } from "./session.fixture";
import { sessionQuery } from "./session-query.fixture";

test("a feature attempt keeps its recorded base when its owner stops", async () => {
  const f = await fixture();
  const parent = await f.ticket("Delivered feature dependency");
  const done = (await statusesCollection(f.storage).list()).find(({ name }) => name === "Done")!;
  await putTicket(f.storage, {
    ...parent,
    statusId: done.id,
    reviewLinks: [
      {
        id: "pr",
        provider: "github",
        kind: "pull_request",
        externalId: "1",
        title: null,
        url: "https://github.com/acme/tools/pull/1",
        createdAt: "2026-10-15T00:00:00Z",
        updatedAt: "2026-10-15T00:00:00Z",
      },
    ],
  });
  const child = await f.ticket("Continue feature", [parent.id]);
  const workspace = {
    id: "draft",
    project_id: f.ctx.projectId,
    root_path: "/repo/draft",
    execution_kind: "local" as const,
    provider_id: "pstdio.worktree",
    provider_state: "ready" as const,
    provider_capabilities_json: { diff: true },
    anchors_json: [{ type: "ticket", id: child.id }],
  };
  f.ctx.workspaces.get = async () => workspace as never;
  const run = f.ctx.process.run;
  f.ctx.process.run = async (input) => {
    const command = input.command;
    if (command[0] === "gh")
      return {
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify({ state: "MERGED", headRefOid: "parent-head", mergeCommit: { oid: "feature-merge" } }),
      };
    if (
      command.includes("feature^{commit}") ||
      command.includes("feature-head^{commit}") ||
      (command[2] === "/repo/draft" && command.includes("rev-parse"))
    )
      return { exitCode: 0, stdout: "feature-head\n", stderr: "" };
    if (command.includes("--is-ancestor"))
      return {
        exitCode:
          command.at(-2) === command.at(-1) || (command.at(-2) === "feature-merge" && command.at(-1) === "feature-head")
            ? 0
            : 1,
        stdout: "",
        stderr: "",
      };
    return run(input);
  };
  const started = await autoBuildDispatchCommand.run(f.ctx, {
    ticket: child.id,
    revision: "test",
    base: "feature",
    workspaceId: "draft",
  });
  expect(started).toMatchObject({ decision: "started", workspaceId: "draft" });
  const owner = createSessionResource({ id: "session-0", title: "Owner", status: "completed" });
  f.ctx.sessions.get = async () => owner;
  f.ctx.sessions.query = sessionQuery(async () => [owner]);
  const result = await nextTicketsCommand.run(f.ctx, {});
  expect(result.tickets).toContainEqual(expect.objectContaining({ id: child.id, action: "resume" }));
  let resumed: string | undefined;
  f.ctx.sessions.followup = async ({ sessionId }) => {
    resumed = sessionId;
    return {} as never;
  };
  expect(await autoBuildDispatchCommand.run(f.ctx, { ticket: child.id, revision: "test" })).toMatchObject({
    decision: "started",
    workspaceId: "draft",
    sessionId: owner.id,
  });
  expect(resumed).toBe(owner.id);
});
