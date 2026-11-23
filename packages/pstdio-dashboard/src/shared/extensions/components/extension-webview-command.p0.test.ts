import { describe, expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createWorkbench, getWorkbenchOperations } from "@pstdio/workbench";
import { emptyWorkbenchExtensionMetadata, registerWorkbenchExtensionContributions } from "@pstdio/workbench/extensions";
import { executeWebviewCommand } from "./extension-webview-command";

describe("executeWebviewCommand", () => {
  test("runs registered workbench commands in the host", async () => {
    const workbench = createWorkbench();
    const extensionCalls: unknown[] = [];
    workbench.commands.registerCommand(
      { id: "workbench.test.open", label: "Open" },
      {
        execute: (params, context) => ({ context, params, source: "workbench" }),
      },
    );
    const result = await executeWebviewCommand({
      commandId: "workbench.test.open",
      params: { modeId: "lab" },
      resource: { type: "ticket", id: "PS-1", label: "Ticket", metadata: { status: "open" } },
      workbench,
      executeExtensionCommand: async (input) => {
        extensionCalls.push(input);
      },
    });
    expect(result).toMatchObject({
      outcome: {
        ok: true,
        status: "success",
        value: {
          context: {
            resource: {
              id: "PS-1",
              type: "ticket",
              label: "Ticket",
              metadata: { status: "open" },
            },
          },
          params: { modeId: "lab" },
          source: "workbench",
        },
      },
    });
    expect(extensionCalls).toEqual([]);
  });
  test("sends extension commands to the project API", async () => {
    const workbench = createWorkbench();
    const extensionCalls: unknown[] = [];
    await executeWebviewCommand({
      commandId: "extension-lab.counter.bump",
      metadata: { sourcePanel: "lab" },
      params: { amount: 1 },
      resource: { type: "counter", id: "main" },
      workspaceId: "remote-workspace",
      workbench,
      executeExtensionCommand: async (input) => {
        extensionCalls.push(input);
      },
    });
    expect(extensionCalls).toEqual([
      {
        commandId: "extension-lab.counter.bump",
        metadata: { sourcePanel: "lab" },
        params: { amount: 1 },
        resource: { type: "counter", id: "main" },
        workspaceId: "remote-workspace",
      },
    ]);
  });
  test("keeps the command outcome envelope for extension commands registered in the workbench", async () => {
    const workbench = createWorkbench();
    const extensionCalls: unknown[] = [];
    const response = {
      commandId: "pstdio.extension-lab.command.counter.read",
      extensionId: "pstdio.extension-lab",
      outcome: { ok: true, status: "success", value: { counter: 1 } },
    };
    workbench.commands.registerCommand(
      { id: response.commandId, label: "Read counter" },
      { execute: () => response.outcome.value },
    );
    const result = await executeWebviewCommand({
      commandId: response.commandId,
      workbench,
      executeExtensionCommand: async (input) => {
        extensionCalls.push(input);
        return response;
      },
    });
    expect(result).toEqual(response);
    expect(extensionCalls).toEqual([{ commandId: response.commandId }]);
  });
});

test("webview command results replace the captured caller through the public navigation contract", async () => {
  const workbench = createWorkbench();
  const owner = "example.records";
  const panel = { kind: "placement" as const, extensionId: owner, id: "viewer" };
  const resource = (id: string) => ({ type: "record", id, extensionId: owner, projectId: "project" });
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({ id: "record", title: "Record", body: { kind: "react", render: () => null } });
  workbench.modePlacements.registerPlacement({
    id: "viewer",
    ref: panel,
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        cardinality: "many",
        view: { kind: "view", id: "record" },
        kinds: [{ kind: "resource-kind", extensionId: owner, id: "record" }],
      },
    },
  });
  const page = { kind: "page" as const, extensionId: owner, id: "home" };
  workbench.pages.registerPage({
    id: "home",
    ref: page,
    path: "",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  workbench.pageLocations.setProject("project");
  workbench.pageLocations.navigate({ kind: "page", page });
  workbench.modePlacements.openPlacement({ panel, resource: resource("draft"), open: "pin" });
  const caller = workbench.layout.getActivePanel("side")!;
  await executeWebviewCommand({
    commandId: `${owner}.command.create`,
    projectId: "project",
    workbench,
    placement: caller.placementIdentity,
    executeExtensionCommand: async () => ({
      outcome: {
        status: "success",
        navigationRequests: [
          { kind: "viewer", operation: "replace", from: resource("draft"), resource: resource("created") },
        ],
      },
    }),
  });
  expect(workbench.layout.getActivePanel("side")?.instanceId).toBe(caller.instanceId);
  expect(workbench.layout.getActivePanel("side")?.resource?.id).toBe("created");
});

test("applies extension navigation once and preserves the webview response", async () => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("project");
  let navigations = 0;
  workbench.commands.registerCommand(
    { id: "workbench.test.open", label: "Open" },
    {
      execute: () => {
        navigations += 1;
      },
    },
  );
  const response = {
    commandId: "example.notes.command.create",
    extensionId: "example.notes",
    outcome: {
      ok: true,
      status: "success",
      value: { id: "note" },
      navigationRequests: [
        { kind: "command", target: { command: { kind: "command", extensionId: "pstdio", id: "workbench.test.open" } } },
      ],
    },
  };
  const result = await executeWebviewCommand({
    commandId: response.commandId,
    projectId: "project",
    workbench,
    executeExtensionCommand: async () => response,
  });
  expect(navigations).toBe(1);
  expect(result).toBe(response);
});

test("dashboard webviews receive structured command rejections", async () => {
  const response = {
    outcome: { ok: false, status: "rejected", code: "needs_review", reason: "Review first", data: { revision: 2 } },
  };
  expect(
    await executeWebviewCommand({
      commandId: "notes.command.save",
      projectId: "project",
      workbench: createWorkbench(),
      executeExtensionCommand: async () => response,
    }),
  ).toEqual(response);
});

test("dashboard native commands receive resource and cancellation context", async () => {
  const workbench = createWorkbench();
  const controller = new AbortController();
  workbench.commands.registerCommand(
    { id: "native.read", label: "Read" },
    { execute: (_params, context) => ({ resource: context?.resource, aborted: context?.signal?.aborted }) },
  );
  controller.abort();
  const result = await executeWebviewCommand({
    commandId: "native.read",
    resource: { type: "note", id: "1" },
    signal: controller.signal,
    workbench,
    executeExtensionCommand: async () => {
      throw new Error("Unexpected API call");
    },
  });
  expect(result).toMatchObject({ outcome: { value: { resource: { type: "note", id: "1" }, aborted: true } } });
});

test("the dashboard workspace form retains one unresolved create across reopened webviews", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  workbench.pageLocations.setProject("project");
  const params = { providerId: "provider", params: { name: "Draft workspace" } };
  let writes = 0;
  const input = {
    commandId: "pstdio.workspaces.command.create",
    projectId: "project",
    params,
    workbench,
    executeExtensionCommand: async () => {
      writes++;
      throw new PstdioConnectionError(new Error("Workspace response lost"));
    },
  };
  try {
    for (let opening = 0; opening < 2; opening++) {
      expect(await executeWebviewCommand(input)).toMatchObject({
        outcome: { status: "error", code: "workspace_create_unconfirmed" },
      });
    }
    expect(writes).toBe(1);
    expect(getWorkbenchOperations(queries).getSnapshot().recovery).toMatchObject([
      { title: "Create workspace", status: "unknown", draft: { params } },
    ]);
  } finally {
    await workbench.dispose();
    queries.dispose();
  }
});

test("an extension create in a dashboard webview shares its recovery with the native command", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  workbench.pageLocations.setProject("project");
  const extensionId = "example.notes";
  const commandId = `${extensionId}.command.create`;
  const declarations = {
    ...emptyWorkbenchExtensionMetadata,
    commands: [{ id: commandId, extensionId, title: "Create note" }],
    keybindings: [
      {
        id: `${extensionId}.keybinding.create`,
        extensionId,
        layer: "create",
        action: { kind: "command", target: { command: { kind: "command", id: "create", extensionId } } },
        key: "N",
        canonicalChord: "N",
        parsed: { key: "N", ctrl: false, shift: false, alt: false, meta: false, modifiers: [] },
      },
    ],
  } satisfies Parameters<typeof registerWorkbenchExtensionContributions>[0]["metadata"];
  let nativeWrites = 0;
  const registration = registerWorkbenchExtensionContributions({
    metadata: declarations,
    projectId: "project",
    queries,
    workbench,
    executeCommand: () => {
      nativeWrites++;
      return {};
    },
  });
  const input = { commandId, projectId: "project", params: { title: "Draft note" }, workbench, declarations };
  const rejected = {
    outcome: { ok: false, status: "rejected", code: "review", reason: "Review first", data: { revision: 2 } },
  };
  try {
    expect(await executeWebviewCommand({ ...input, executeExtensionCommand: async () => rejected })).toBe(rejected);
    expect(
      await executeWebviewCommand({
        ...input,
        executeExtensionCommand: async () => {
          throw new PstdioConnectionError(new Error("Note response lost"));
        },
      }),
    ).toMatchObject({ outcome: { code: "resource_create_unconfirmed" } });
    await expect(workbench.commands.executeCommand(commandId, { title: "Another draft" })).rejects.toMatchObject({
      name: "UnresolvedSubmissionError",
    });
    expect(nativeWrites).toBe(0);
    expect(getWorkbenchOperations(queries).getSnapshot().recovery.at(-1)).toMatchObject({
      title: "Create note",
      status: "unknown",
      draft: input.params,
    });
  } finally {
    registration.dispose();
    await workbench.dispose();
    queries.dispose();
  }
});
