import { describe, expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench } from "../../core";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";
import { createWorkbenchExtensionWebviewAdapters } from "./webview-command-capabilities";

const createCapabilities =
  (input: Parameters<typeof createWorkbenchExtensionWebviewAdapters>[0]) =>
  (context: Parameters<ReturnType<typeof createWorkbenchExtensionWebviewAdapters>>[0]) =>
    createExtensionWebviewHostCapabilities(createWorkbenchExtensionWebviewAdapters(input)(context));

describe("extension webview command adapters", () => {
  test("preserves the requested workspace and command metadata", async () => {
    const requests: unknown[] = [];
    const workbench = createWorkbench();
    workbench.pageLocations.setProject("project");
    const capabilities = createCapabilities({
      executeCommand: (commandId, body) => {
        requests.push({ commandId, body });
        return { outcome: { ok: true, status: "success" } };
      },
      extensionIdForWebview: () => "notes",
      projectId: "project",
      slotKind: "panel",
    })({ placement: {}, webviewId: "notes", workbench } as never);
    await capabilities["commands.execute"]?.({
      commandId: "notes.command.read",
      workspaceId: "remote-workspace",
      metadata: { sourcePanel: "notes" },
    });
    expect(requests).toMatchObject([
      {
        commandId: "notes.command.read",
        body: { workspaceId: "remote-workspace", metadata: { sourcePanel: "notes" } },
      },
    ]);
  });

  test("navigation.open resolves page refs against the webview extension", async () => {
    const workbench = createWorkbench();
    const page = { extensionId: "pstdio.lab", kind: "page" as const, id: "tickets" };
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.views.registerView({
      id: "tickets",
      title: "Tickets",
      body: { kind: "react", render: () => null },
    });
    workbench.pages.registerPage({
      id: "pstdio.lab.page.tickets",
      ref: page,
      title: "Tickets",
      path: "tickets",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "tickets",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    const capabilities = createCapabilities({
      executeCommand: async () => ({}),
      extensionIdForWebview: () => "pstdio.lab",
      projectId: "project-1",
      slotKind: "panel",
    })({
      placement: { resource: undefined },
      webviewId: "panel-1",
      workbench,
    } as never);
    await capabilities["navigation.open"]?.({ target: { kind: "page", page: { kind: "page", id: "tickets" } } });
    expect(workbench.pages.store.getState().activePageId).toBe("pstdio.lab.page.tickets");
  });
});

test("webview command calls apply navigation once and preserve the response envelope", async () => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("project");
  let opened = 0;
  workbench.commands.registerCommand(
    { id: "open", label: "Open" },
    {
      execute: () => {
        opened++;
      },
    },
  );
  const response = {
    commandId: "notes.create",
    extensionId: "notes",
    outcome: {
      ok: true,
      status: "success",
      value: { id: "one" },
      navigationRequests: [
        { kind: "command", target: { command: { kind: "command", id: "open", extensionId: "pstdio" } } },
      ],
    },
  };
  const capabilities = createCapabilities({
    executeCommand: () => response,
    extensionIdForWebview: () => "notes",
    projectId: "project",
    slotKind: "panel",
  })({ placement: {}, webviewId: "notes", workbench } as never);
  expect(await capabilities["commands.execute"]?.({ commandId: "notes.create" })).toEqual(response);
  expect(opened).toBe(1);
});

test("webviews receive structured command rejections", async () => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("project");
  const response = {
    outcome: { ok: false, status: "rejected", code: "needs_review", reason: "Review first", data: { revision: 2 } },
  };
  const capabilities = createCapabilities({
    executeCommand: () => response,
    extensionIdForWebview: () => "notes",
    projectId: "project",
    slotKind: "panel",
  })({ placement: {}, webviewId: "notes", workbench } as never);
  expect(await capabilities["commands.execute"]?.({ commandId: "notes.command.save" })).toEqual(response);
});

test("a workspace form preserves an unknown submission without repeating its provider request", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  workbench.pageLocations.setProject("project");
  let writes = 0;
  const adapters = createCapabilities({
    projectId: "project",
    slotKind: "panel",
    extensionIdForWebview: () => "pstdio.workspaces",
    executeCommand: () => {
      writes++;
      throw new PstdioConnectionError(new Error("Workspace response lost"));
    },
  });
  const request = {
    commandId: "pstdio.workspaces.command.create",
    params: { providerId: "provider", params: { name: "New folder" } },
  };
  try {
    for (const webviewId of ["first", "reopened"]) {
      const capabilities = adapters({ placement: {}, webviewId, workbench } as never);
      expect(await capabilities["commands.execute"](request)).toMatchObject({
        outcome: { status: "error", code: "workspace_create_unconfirmed" },
      });
    }
    expect(writes).toBe(1);
    expect(getWorkbenchOperations(queries).getSnapshot().recovery[0]).toMatchObject({
      title: "Create workspace",
      status: "unknown",
      draft: { params: request.params },
    });
  } finally {
    await workbench.dispose();
    queries.dispose();
  }
});

test("a webview workspace rename previews its canonical label in another workbench", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  const peer = createWorkbench({ queries });
  workbench.pageLocations.setProject("project");
  const response = Promise.withResolvers<unknown>();
  const capabilities = createCapabilities({
    executeCommand: () => response.promise,
    extensionIdForWebview: () => "pstdio.workspaces",
    projectId: "project",
    slotKind: "panel",
  })({ placement: {}, webviewId: "workspace-form", workbench } as never);
  const resource = { type: "workspace", extensionId: "pstdio", id: "workspace", projectId: "project", label: "Before" };
  try {
    const pending = capabilities["commands.execute"]({
      commandId: "pstdio.workspaces.command.rename",
      params: { id: resource.id, name: "During" },
    });
    expect(peer.resources.preview.resolve(resource)?.label).toBe("During");
    response.resolve({ outcome: { ok: false, status: "rejected", reason: "Rename was rejected" } });
    expect(await pending).toMatchObject({ outcome: { status: "rejected" } });
    expect(peer.resources.preview.resolve(resource)?.label).toBe("Before");
  } finally {
    await workbench.dispose();
    await peer.dispose();
    queries.dispose();
  }
});

const plannerReviewDraft = { requestId: "review-a", response: { answers: { direction: ["first", "because"] } } };
const autoBuildDraft = {
  enabled: true,
  prompt: "Use the checked-in tests",
  eligible: { conjunction: "and", rules: [] },
  supervisorModel: { harnessId: "codex", model: "model" },
  requireMergedDependencies: true,
};

test.each([
  { id: "review", draft: plannerReviewDraft },
  { id: "auto-build.configure", draft: autoBuildDraft },
])("retains the original Planner $id input after its frame disconnects", async ({ id, draft }) => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  workbench.pageLocations.setProject("project");
  const operations = getWorkbenchOperations(queries);
  const events = createHostEventPublisher();
  events.bind(() => {});
  const entered = Promise.withResolvers<void>();
  const response = Promise.withResolvers<unknown>();
  const extensionId = "pstdio.planner";
  const commandId = `${extensionId}.command.${id}`;
  const capabilities = createCapabilities({
    executeCommand: (_, input) => {
      if (input.params?.requestId === "review-b") return { outcome: { ok: true, status: "success" } };
      entered.resolve();
      return response.promise;
    },
    extensionIdForWebview: () => extensionId,
    projectId: "project",
    slotKind: "panel",
    metadata: { commands: [{ id: commandId, extensionId, title: "Planner action", mutating: true }] },
  })({ placement: {}, webviewId: "planner", workbench, hostEvents: events } as never);
  try {
    const pending = Promise.resolve(
      capabilities["commands.execute"]({ commandId, params: { ...draft, token: "private" } }),
    );
    const settled = pending.catch((error: unknown) => error);
    await entered.promise;
    expect(operations.getSnapshot().pending[0]).toMatchObject({ showPending: true, status: "writing" });
    events.unbind();
    response.reject(new PstdioConnectionError(new Error("Reply lost")));
    await settled;
    expect(operations.getSnapshot().recovery[0]).toMatchObject({ status: "unknown", canCheck: false });
    expect(operations.getSnapshot().recovery[0]?.draft).toEqual({ commandId, ...draft });
    if (id === "review") {
      events.bind(() => {});
      await expect(
        Promise.resolve(
          capabilities["commands.execute"]({ commandId, params: { ...plannerReviewDraft, requestId: "review-b" } }),
        ),
      ).resolves.toMatchObject({ outcome: { status: "success" } });
    }
  } finally {
    response.resolve(undefined);
    events.unbind();
    await workbench.dispose();
    queries.dispose();
  }
});
