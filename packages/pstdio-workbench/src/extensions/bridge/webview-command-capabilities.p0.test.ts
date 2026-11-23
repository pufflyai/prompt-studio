import { describe, expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
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
