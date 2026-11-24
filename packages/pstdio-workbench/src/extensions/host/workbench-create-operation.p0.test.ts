import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { defaultPageResourceCodec } from "pstdio-api-contracts/extension-kernel";
import { createWorkbench } from "../../core";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { runWorkbenchWebviewCommandOperation } from "../bridge/webview-command-operations";
import { plannerGateLaunch, plannerGateLaunchCheck } from "./workbench-command-operation";
import { type BoardCreationIntent, runCreateOperation } from "./workbench-create-operation";
import { executeWorkbenchExtensionCommand } from "./workbench-extension-command";

const command = { id: "planner.create-ticket", extensionId: "planner", title: "Create ticket" };

test.each([
  "SessionCreateRefused",
  "Error",
])("older Planner gate metadata handles %s without an undeclared check", async (name) => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const workbench = createWorkbench({ queries });
  const launch = { id: plannerGateLaunch, extensionId: "pstdio.planner", title: "Review gate", mutating: true };
  const failure = {
    outcome: {
      ok: false,
      status: "error",
      reason: "Cannot start session",
      error: { name, message: "Cannot start session" },
    },
  };
  const success = { outcome: { ok: true, status: "success", value: { id: "known-session" } } };
  let launches = 0;
  const invoke = () =>
    runWorkbenchWebviewCommandOperation({
      workbench,
      projectId: "project",
      metadata: { commands: [launch] },
      request: { commandId: plannerGateLaunch, params: { ticket: "gate", attemptId: "rolling-client" } },
      readGateLaunch: async () => {
        throw new Error("Older Planner does not expose this command");
      },
      execute: async () => (++launches === 1 ? failure : success),
    });
  try {
    expect(await invoke()).toEqual(failure);
    const refusal = name === "SessionCreateRefused";
    expect(operations.getSnapshot().recovery[0]).toMatchObject({
      status: refusal ? "rejected" : "unknown",
      canCheck: false,
    });
    if (refusal) {
      expect(await invoke()).toEqual(success);
      expect(launches).toBe(2);
    } else {
      await expect(invoke()).rejects.toThrow("still pending");
      expect(launches).toBe(1);
    }
  } finally {
    await workbench.dispose();
    queries.dispose();
  }
});

test.each([
  "original",
  "returned",
] as const)("the %s authority can confirm the exact Planner gate through the bridge", async (authority) => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio", accountId: "original" });
  const operations = getWorkbenchOperations(queries);
  const workbench = createWorkbench({ queries });
  const projectId = "project";
  const metadata = {
    commands: [
      { id: plannerGateLaunch, extensionId: "pstdio.planner", title: "Review gate", mutating: true },
      { id: plannerGateLaunchCheck, extensionId: "pstdio.planner", title: "Check gate review launch" },
    ],
  };
  const success = (value: unknown) => ({ outcome: { ok: true, status: "success", value } });
  const ticket = "ticket-1";
  let writes = 0;
  let visible = false;
  const confirmed = (launchId: string) => ({ status: "confirmed", launchId, session: { id: "review-1" } });
  const readGateLaunch = async ({ ticket: checkedTicket, attemptId }: { ticket: string; attemptId: string }) => {
    expect(checkedTicket).toBe(ticket);
    return success(visible ? confirmed(attemptId) : { status: "unconfirmed" });
  };
  const launch = (attemptId: string, after?: string) =>
    runWorkbenchWebviewCommandOperation({
      workbench,
      projectId,
      metadata,
      request: { commandId: plannerGateLaunch, params: { ticket, attemptId, after } },
      readGateLaunch,
      execute: async () => {
        if (++writes === 1) throw new PstdioConnectionError(new Error("Response lost"));
        if (writes === 2)
          return {
            outcome: {
              ok: false,
              status: "error",
              reason: "No harness",
              error: { name: "GateLaunchRefused", message: "No harness" },
            },
          };
        return success({ id: "review-2" });
      },
    });
  const check = (launchId: string, held?: Promise<void>) =>
    runWorkbenchWebviewCommandOperation({
      workbench,
      projectId,
      metadata,
      request: { commandId: plannerGateLaunchCheck, params: { ticket } },
      execute: async () => {
        await held;
        return success(confirmed(launchId));
      },
    });
  try {
    await expect(launch("lost")).rejects.toBeInstanceOf(PstdioConnectionError);
    const [entry] = operations.getSnapshot().recovery;
    expect(entry).toMatchObject({ status: "unknown", canCheck: true, draft: { ticket, attemptId: "lost" } });
    await operations.check(entry!.id);
    expect(operations.getSnapshot().recovery).toHaveLength(1);
    await expect(launch("blind-repeat")).rejects.toThrow("still pending");
    if (authority === "returned") {
      const held = Promise.withResolvers<void>();
      const stale = check("lost", held.promise);
      queries.setAuthority({ accountId: "other" });
      expect(operations.getSnapshot().recovery).toEqual([]);
      queries.setAuthority({ accountId: "original" });
      held.resolve();
      await stale;
      expect(operations.getSnapshot().recovery[0]).toMatchObject({ status: "unknown", canCheck: false });
    }
    visible = true;
    await check("unrelated");
    expect(operations.getSnapshot().recovery).toHaveLength(1);
    await check("lost");
    expect(operations.getSnapshot().recovery).toEqual([]);

    await expect(launch("refused", "review-1")).resolves.toMatchObject({ outcome: { ok: false } });
    expect(operations.getSnapshot().recovery[0]).toMatchObject({ status: "rejected", canCheck: false });
    await expect(launch("intentional", "review-1")).resolves.toEqual(success({ id: "review-2" }));
    expect(writes).toBe(3);
  } finally {
    await workbench.dispose();
    queries.dispose();
  }
});

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

test("acknowledged creation settles while its attachment remains independently in flight", async () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio", accountId: "original" });
  const operations = getWorkbenchOperations(queries);
  const attachmentStarted = Promise.withResolvers<void>();
  const attachmentResponse = Promise.withResolvers<void>();
  let attachment: Promise<void> | undefined;
  try {
    const created = runCreateOperation(operations, "project", command, {}, async () => ({ id: "confirmed" }), {
      onCreated: () => {
        attachment = operations
          .submit({
            projectId: "project",
            title: "Attach file to confirmed ticket",
            domain: "resource.attachments",
            subjects: ["confirmed attachment"],
            write: () => {
              attachmentStarted.resolve();
              return attachmentResponse.promise;
            },
          })
          .result.catch(() => {});
      },
    });
    await expect(created).resolves.toEqual({ id: "confirmed" });
    await attachmentStarted.promise;
    queries.setAuthority({ accountId: "other" });
    queries.setAuthority({ accountId: "original" });
    expect(operations.getSnapshot().recovery.map(({ domain, status }) => ({ domain, status }))).toEqual([
      { domain: "resource.attachments", status: "unknown" },
    ]);
    await expect(
      runCreateOperation(operations, "project", command, {}, async () => ({ id: "second" })),
    ).resolves.toEqual({ id: "second" });
    await attachment;
  } finally {
    attachmentResponse.resolve();
    queries.dispose();
  }
});

test("a successful Check again releases the original create draft without replaying the write", async () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  let writes = 0;
  let reads = 0;
  let reconciled = 0;
  try {
    const created = runCreateOperation(operations, "project", command, {}, async () => ({ id: String(++writes) }), {
      originatingRead: {
        key: "board",
        refresh() {
          if (++reads === 1) throw new Error("Board temporarily unavailable");
        },
      },
      onReconciled: () => {
        reconciled++;
      },
    });
    await expect(created).rejects.toMatchObject({ name: "UnresolvedSubmissionError" });
    expect(reconciled).toBe(0);
    const [interrupted] = operations.getSnapshot().recovery;
    expect(interrupted).toMatchObject({ status: "unconfirmed", canCheck: true });
    await operations.check(interrupted.id);
    expect(reconciled).toBe(1);
    expect(writes).toBe(1);
    expect(operations.getSnapshot().recovery).toEqual([]);
  } finally {
    queries.dispose();
  }
});

test("retiring a board read after a create acknowledgement does not fence new creations", async () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio", accountId: "original" });
  const operations = getWorkbenchOperations(queries);
  const reading = Promise.withResolvers<void>();
  const releaseRead = Promise.withResolvers<void>();
  let settled = 0;
  try {
    const result = runCreateOperation(operations, "project", command, {}, async () => ({ id: "confirmed" }), {
      originatingRead: {
        key: "board",
        refresh() {
          reading.resolve();
          return releaseRead.promise;
        },
      },
      onReconciled() {
        settled++;
      },
    });
    await reading.promise;
    queries.setAuthority({ accountId: "other" });
    await expect(result).rejects.toThrow("authority");
    expect(settled).toBe(1);
    queries.setAuthority({ accountId: "original" });
    expect(operations.getSnapshot().recovery).toMatchObject([
      { status: "unconfirmed", acknowledged: true, canCheck: false },
    ]);
    await expect(
      runCreateOperation(operations, "project", command, {}, async () => ({ id: "second" })),
    ).resolves.toEqual({ id: "second" });
  } finally {
    releaseRead.resolve();
    queries.dispose();
  }
});

test.each(["AttemptLaunchRefused", "Error"])("classifies a Planner attempt report from %s", async (name) => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const workbench = createWorkbench({ queries });
  const command = {
    id: "pstdio.planner.command.run-attempt",
    extensionId: "pstdio.planner",
    title: "Run attempt",
    mutating: true,
  };
  const response = Promise.withResolvers<unknown>();
  const ticket = { type: "ticket", id: "ticket-1", projectId: "project", extensionId: "pstdio.planner" };
  const draft = {
    ticket: "PS-289",
    newVariant: true,
    agent: { harnessId: "codex", model: "model" },
    workspace: { providerId: "pstdio.worktree", params: { base: "main" } },
  };
  let admitted = false;
  const run = () =>
    executeWorkbenchExtensionCommand(
      {
        workbench,
        projectId: "project",
        operations,
        metadata: { commands: [command] },
        executeCommand: () => response.promise,
      },
      command.id,
      {
        resource: ticket,
        foreground: true,
        params: { ...draft, agent: { ...draft.agent, params: { token: "private" } } },
        onAdmitted: () => {
          admitted = true;
        },
      },
    );
  try {
    const pending = run();
    expect(admitted).toBe(true);
    expect(operations.getSnapshot().pending[0]).toMatchObject({ title: "Run attempt", showPending: true });
    response.resolve({
      outcome: { ok: false, status: "error", reason: "Could not run", error: { name, message: "Could not run" } },
    });
    await expect(pending).rejects.toThrow("Could not run");
    expect(operations.getSnapshot().recovery[0]).toMatchObject({
      status: name === "AttemptLaunchRefused" ? "rejected" : "unknown",
      source: ticket,
      draft: { commandId: command.id, ...draft },
    });
    expect(operations.getSnapshot().recovery[0]?.draft).toEqual({ commandId: command.id, ...draft });
  } finally {
    await workbench.dispose();
    queries.dispose();
  }
});

test("returning to a Planner authority cannot replay an unconfirmed attempt", async () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio", accountId: "original" });
  const operations = getWorkbenchOperations(queries);
  const workbench = createWorkbench({ queries });
  const command = {
    id: "pstdio.planner.command.run-attempt",
    extensionId: "pstdio.planner",
    title: "Run attempt",
    mutating: true,
  };
  const transmitted = Promise.withResolvers<void>();
  const firstReply = Promise.withResolvers<unknown>();
  let writes = 0;
  const run = () =>
    executeWorkbenchExtensionCommand(
      {
        workbench,
        projectId: "project",
        operations,
        metadata: { commands: [command] },
        executeCommand: async () => {
          if (++writes === 1) {
            transmitted.resolve();
            return firstReply.promise;
          }
          return { outcome: { ok: true, status: "success", value: { id: "second" } } };
        },
      },
      command.id,
      { foreground: true, params: { ticket: "PS-289", newVariant: true } },
    );
  try {
    const first = run();
    const settled = first.catch((error: unknown) => error);
    await transmitted.promise;
    queries.setAuthority({ accountId: "other" });
    queries.setAuthority({ accountId: "original" });
    firstReply.resolve({ outcome: { ok: true, status: "success", value: { id: "first" } } });
    expect(await settled).toBeInstanceOf(Error);
    expect(operations.getSnapshot().pending).toHaveLength(0);
    const [recovery] = operations.getSnapshot().recovery;
    expect(recovery).toMatchObject({ status: "unknown", canCheck: false });
    await expect(run()).rejects.toThrow("System activity");
    expect(writes).toBe(1);
    operations.discard(recovery.id);
    await expect(run()).resolves.toBeDefined();
    expect(writes).toBe(2);
  } finally {
    firstReply.resolve();
    await workbench.dispose();
    queries.dispose();
  }
});
