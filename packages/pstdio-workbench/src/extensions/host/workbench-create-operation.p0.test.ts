import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { defaultPageResourceCodec } from "pstdio-api-contracts/extension-kernel";
import { createWorkbench } from "../../core";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { type BoardCreationIntent, runCreateOperation } from "./workbench-create-operation";
import { executeWorkbenchExtensionCommand } from "./workbench-extension-command";

const command = { id: "planner.create-ticket", extensionId: "planner", title: "Create ticket" };

test("an uncorrelated create keeps the submitted content and no read can guess its result", async () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const workbench = createWorkbench({ queries });
  const transport = Promise.withResolvers<unknown>();
  let writes = 0;
  const result = executeWorkbenchExtensionCommand(
    {
      projectId: "project",
      workbench,
      operations,
      metadata: { commands: [command] },
      createCommandIds: new Set([command.id]),
      executeCommand: () => {
        writes++;
        return transport.promise;
      },
    },
    command.id,
    { params: { content: "Same title" } },
  );
  const failed = result.catch((error: unknown) => error);
  expect(operations.getSnapshot().pending[0]).toMatchObject({
    status: "queued",
    title: "Create ticket",
    projectId: "project",
  });
  transport.reject(new PstdioConnectionError(new Error("Response lost")));
  const error = await failed;
  expect(error).toMatchObject({ name: "UnresolvedSubmissionError" });
  const entry = operations.getSnapshot().recovery[0];
  expect(entry).toMatchObject({ status: "unknown", canCheck: false, draft: { content: "Same title" } });
  operations.dismiss(entry.id);
  expect(operations.getSnapshot().recovery[0]?.draft).toEqual({ content: "Same title" });
  expect(writes).toBe(1);
  operations.discard(entry.id);
  expect(operations.getSnapshot().recovery).toHaveLength(0);
  await workbench.dispose();
  queries.dispose();
});

test.each(["error", "rejected"] as const)("retains the correct recovery after command outcome %s", async (status) => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const workbench = createWorkbench({ queries });
  try {
    const result = executeWorkbenchExtensionCommand(
      {
        projectId: "project",
        workbench,
        operations,
        metadata: { commands: [command] },
        createCommandIds: new Set([command.id]),
        executeCommand: () => ({ outcome: { status, ok: false, reason: "The command could not finish" } }),
      },
      command.id,
      { params: { content: "Original text" } },
    );
    const expected = status === "error" ? "unknown" : "rejected";
    await expect(result).rejects.toMatchObject({
      name: expected === "unknown" ? "UnresolvedSubmissionError" : "CommandOutcomeError",
    });
    expect(operations.getSnapshot().recovery[0]).toMatchObject({
      status: expected,
      canCheck: false,
      draft: { content: "Original text" },
    });
  } finally {
    await workbench.dispose();
    queries.dispose();
  }
});

test("a remote launch retains the prepared workspace after the session response is lost", async () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const workbench = createWorkbench({ queries });
  const launchId = "pstdio.remote-workspaces.command.launch";
  const provision = "pstdio.remote-workspaces.command.prepare-launch-workspace";
  const start = "pstdio.remote-workspaces.command.start-launch-session";
  const metadata = {
    commands: [launchId, provision, start].map((id) => ({ id, title: id, extensionId: "pstdio.remote-workspaces" })),
  };
  const calls: { id: string; params: unknown }[] = [];
  const sessionResponse = Promise.withResolvers<unknown>();
  const sessionStarted = Promise.withResolvers<void>();
  const executeCommand = (id: string, body: { params?: unknown }) => {
    calls.push({ id, params: body.params });
    if (id === provision) return { workspaceId: "workspace-7", shorthand: "REMOTE-7", ready: true };
    sessionStarted.resolve();
    return sessionResponse.promise;
  };
  const input = { projectId: "project", workbench, operations, metadata, executeCommand };
  const params = { template: "pi", prompt: "Keep this draft" };
  try {
    const first = executeWorkbenchExtensionCommand(input, launchId, { params }).catch((error: unknown) => error);
    await sessionStarted.promise;
    sessionResponse.reject(new PstdioConnectionError(new Error("Session response lost")));
    expect(await first).toMatchObject({
      name: "UnresolvedSubmissionError",
      message: expect.stringContaining("REMOTE-7"),
    });
    const retained = operations.getSnapshot().recovery[0];
    expect(retained).toMatchObject({
      status: "unknown",
      description: "Workspace REMOTE-7 was created. Session creation could not be confirmed.",
      draft: { params, workspace: { id: "workspace-7", shorthand: "REMOTE-7" }, stage: "session" },
    });
    operations.dismiss(retained.id);
    await expect(executeWorkbenchExtensionCommand(input, launchId, { params })).rejects.toThrow("REMOTE-7");
    expect(calls).toEqual([
      { id: provision, params: { template: "pi" } },
      { id: start, params: { workspaceId: "workspace-7", prompt: "Keep this draft" } },
    ]);
  } finally {
    await workbench.dispose();
    queries.dispose();
  }
});

test("admits the board draft before transport and only reconciles with the returned identity", async () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const board: BoardCreationIntent = { viewKey: "filtered-board", columnId: "todo", title: "Same title" };
  const response = Promise.withResolvers<{ id: string }>();
  const read = Promise.withResolvers<void>();
  const reconciling = Promise.withResolvers<void>();
  let writes = 0;
  let admitted = false;
  const result = runCreateOperation(
    operations,
    "project",
    command,
    { content: board.title },
    () => {
      writes++;
      return response.promise;
    },
    {
      board,
      onAdmitted: () => {
        expect(operations.getSnapshot().pending[0]?.intent).toBe(board);
        expect(writes).toBe(0);
        admitted = true;
      },
      originatingRead: {
        key: board.viewKey,
        refresh() {
          reconciling.resolve();
          return read.promise;
        },
      },
    },
  );
  try {
    expect(admitted).toBe(true);
    expect(board.confirmedId).toBeUndefined();
    await expect(runCreateOperation(operations, "project", command, {}, async () => ({}))).rejects.toThrow(
      "already in progress",
    );
    response.resolve({ id: "canonical-ticket" });
    await reconciling.promise;
    expect(operations.getSnapshot().pending[0]?.status).toBe("reconciling");
    expect(board.confirmedId).toBe("canonical-ticket");
    read.resolve();
    await expect(result).resolves.toEqual({ id: "canonical-ticket" });
    expect(operations.getSnapshot().pending).toHaveLength(0);
  } finally {
    response.resolve({ id: "canonical-ticket" });
    read.resolve();
    queries.dispose();
  }
});

test("retains only the artifact publication fields on a lost acknowledgment", async () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const workbench = createWorkbench({ queries });
  const extensionId = "pstdio.artifacts";
  const projectId = "project";
  const command = { id: `${extensionId}.command.publish`, extensionId, title: "Publish artifact", mutating: true };
  const resource = defaultPageResourceCodec.toUri({ type: "artifact", extensionId, projectId, id: "report" });
  const url = `/projects/project/extensions/pstdio.artifacts/artifacts/view?${new URLSearchParams({ resource })}`;
  const fields = { file_path: "reports/weekly.html", favicon: "📊", label: "Weekly", url };
  const connection = Promise.withResolvers<unknown>();
  let admitted = false;
  try {
    const result = executeWorkbenchExtensionCommand(
      { workbench, projectId, operations, metadata: { commands: [command] }, executeCommand: () => connection.promise },
      command.id,
      {
        foreground: true,
        params: { ...fields, url: `${url}&token=private`, authorization: "private", html: "raw content" },
        onAdmitted: () => {
          admitted = true;
        },
      },
    );
    expect(admitted).toBe(true);
    expect(operations.getSnapshot().pending[0]).toMatchObject({ title: "Publish artifact", showPending: true });
    connection.reject(new PstdioConnectionError(new Error("Publication response was lost")));
    await expect(result).rejects.toThrow();
    expect(operations.getSnapshot().recovery[0]).toMatchObject({ status: "unknown", canCheck: false });
    expect(operations.getSnapshot().recovery[0]?.draft).toEqual({ commandId: command.id, ...fields });
  } finally {
    await workbench.dispose();
    queries.dispose();
  }
});
