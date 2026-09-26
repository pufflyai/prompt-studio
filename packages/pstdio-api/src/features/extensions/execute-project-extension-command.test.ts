import { afterEach, beforeEach, expect, test } from "bun:test";
import { executeProjectExtensionCommand } from "./execute-project-extension-command";
import { createWorkspaceContextFixture } from "./workspace-context.test-fixture";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
});
afterEach(async () => {
  await fixture.cleanup();
});

const execute = (body = {}) =>
  executeProjectExtensionCommand(fixture.deps, {
    projectId: "project-1",
    commandId: "example.context.command.inspect",
    body,
  });

test("an omitted workspace and repo use the trusted default workspace in the command context", async () => {
  const result = await execute();
  expect(result.outcome).toMatchObject({
    status: "success",
    value: {
      workspaceId: fixture.workspace.id,
      repoPath: null,
      text: "selected folder",
    },
  });
});

test("a remote default never mounts a linked local repository", async () => {
  Object.assign(fixture.workspace, { execution_kind: "remote", worktree_path: fixture.root });
  expect((await execute()).outcome).toMatchObject({
    status: "success",
    value: {
      workspaceId: fixture.workspace.id,
      repoPath: null,
      text: null,
    },
  });
});

test("explicit legacy repository commands keep their repository context", async () => {
  expect(
    (await execute({ repo: { projectId: "project-1", repoId: "repo-1", path: "/forged" } })).outcome,
  ).toMatchObject({ status: "success", value: { workspaceId: null, repoPath: fixture.root, text: null } });
});
