import { expect, test } from "bun:test";
import { WEBVIEW_HOST_CAPABILITIES } from "pstdio-api-contracts/extension-kernel";
import { createPreviewWorkbench } from "./workbench-preview";
import { baseBench, defaultExecuteCommand } from "./workbench-preview-test-fixtures";

test("testbench webviews keep workspace, placement resource, metadata, and slot", async () => {
  const requests: unknown[] = [];
  const view = {
    id: "lab.view.notes",
    localId: "notes",
    extensionId: "lab",
    title: "Notes",
    body: {
      kind: "webview" as const,
      webview: {
        entry: { kind: "package-asset" as const, path: "./view.tsx", baseUrl: "file:///lab/extension.ts" },
        runtimeUrl: "/runtime",
        moduleUrl: "/module",
        capabilities: ["commands.execute"],
      },
    },
  };
  const workbench = createPreviewWorkbench({
    bench: { ...baseBench, metadata: { ...baseBench.metadata, views: [view] } },
    executeCommand: async (commandId, request) => {
      requests.push(request);
      return defaultExecuteCommand(commandId);
    },
    getLastCommand: () => null,
    getThemePreference: () => "system",
    lastCommand: null,
    onCommandCall: () => undefined,
    publishLastCommand: (commandId, response) => ({
      commandId,
      extensionId: response.extensionId,
      outcome: response.outcome,
      tick: 1,
    }),
    setThemePreference: () => undefined,
    themePreference: "system",
  });
  const resource = { type: "note", id: "note-1" };
  const body = workbench.views.getView(view.id)!.body;
  if (body.kind !== "react") throw new Error("Expected a hosted webview");
  const frame = body.render({
    workbench,
    panel: { id: view.id, title: "Notes", region: "main", rendererId: view.id },
    instance: { instanceId: "placement", panelId: view.id, viewId: view.id, closable: true, resource },
    refresh: () => undefined,
  }) as { props: { capabilities: Record<string, (request: unknown) => Promise<unknown>> } };
  expect(Object.keys(frame.props.capabilities).sort()).toEqual([...WEBVIEW_HOST_CAPABILITIES].sort());
  const supported = new Set([
    "harnesses.read",
    "resources.actions",
    "commands.execute",
    "navigation.open",
    "page.params.update",
    "notification.show",
    "preferences.get",
    "preferences.set",
    "terminal.session",
    "files.upload",
    "files.list",
    "files.delete",
  ]);
  for (const name of WEBVIEW_HOST_CAPABILITIES) {
    await expect(Promise.resolve().then(() => frame.props.capabilities[name]!(null))).rejects.toMatchObject({
      code: supported.has(name) ? "invalid_params" : "unsupported",
      data: { capability: name },
    });
  }
  await frame.props.capabilities["commands.execute"]!({
    commandId: "lab.command.read",
    workspaceId: "remote-1",
    metadata: { source: "preview" },
  });
  expect(requests).toMatchObject([
    {
      workspaceId: "remote-1",
      resource,
      metadata: { source: "preview" },
      slot: { id: view.id, kind: "panel", context: { projectId: baseBench.projectId } },
    },
  ]);
  expect(await frame.props.capabilities["harnesses.read"]!({ model: "bench-deep" })).toMatchObject({
    selection: { harnessId: "bench.harness.scripted", model: "bench-deep" },
    defaults: { effort: "medium" },
  });
});
