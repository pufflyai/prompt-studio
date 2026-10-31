import { expect, test } from "bun:test";
import { WEBVIEW_HOST_CAPABILITIES } from "pstdio-api-contracts/extension-kernel";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";

const requests = {
  "performance.read": { operation: "state" },
  "performance.control": { operation: "set-enabled", enabled: true },
  "harnesses.read": {},
  "resources.actions": { operation: "list", resource: { type: "ticket", id: "one" } },
  "commands.execute": { commandId: "notes.read" },
  "editing.session": { operation: "close", sessionId: "editor" },
  "editing.text": { operation: "current" },
  "commands.stream": { operation: "cancel", streamId: "stream" },
  "navigation.open": { target: { kind: "page", page: { kind: "page", id: "notes" } } },
  "page.params.update": { params: {} },
  "placement.close": {},
  "notification.show": { level: "info", title: "Saved" },
  "notification.action": { title: "Review", kind: "info" },
  "notification.resolve": { id: "notification" },
  "notification.dismiss": { id: "notification" },
  "preferences.get": { name: "density" },
  "preferences.set": { name: "density", value: "compact" },
  "extension.settings.all": {},
  "extension.settings.get": { key: "density" },
  "extension.settings.set": { key: "density", value: "compact" },
  "extension.settings.delete": { key: "density" },
  "terminal.session": { operation: "kill", sessionId: "terminal" },
  "files.upload": { name: "note.txt", data: new Uint8Array([1]) },
  "files.list": {},
  "files.delete": { id: "file" },
  "artifacts.read": { op: "readText", mount: "notes", path: "note.md" },
  "account.read": { op: "status" },
  "account.manage": { op: "logout" },
};

test("every host capability returns the same unsupported error without its service", async () => {
  const capabilities = createExtensionWebviewHostCapabilities({});
  expect(Object.keys(capabilities).sort()).toEqual([...WEBVIEW_HOST_CAPABILITIES].sort());
  for (const capability of WEBVIEW_HOST_CAPABILITIES) {
    await expect(Promise.resolve().then(() => capabilities[capability](requests[capability]))).rejects.toMatchObject({
      code: "unsupported",
      data: { capability },
    });
  }
});

test("command execution preserves the complete outcome and validates input before calling the service", async () => {
  const response = {
    commandId: "notes.save",
    extensionId: "notes",
    outcome: {
      ok: false,
      status: "rejected",
      code: "stale_revision",
      reason: "Changed",
      data: { revision: 2 },
      cause: { source: "storage" },
      notices: [{ type: "warning", message: "Reload" }],
      diagnostics: [{ code: "conflict", message: "Changed", severity: "warning" }],
    },
  };
  let executions = 0;
  const capabilities = createExtensionWebviewHostCapabilities({
    executeCommand: async () => {
      executions++;
      return response;
    },
  });
  expect(await capabilities["commands.execute"]({ commandId: "notes.save" })).toEqual(response);
  await expect(Promise.resolve().then(() => capabilities["commands.execute"]({ commandId: 1 }))).rejects.toMatchObject({
    code: "invalid_params",
  });
  expect(executions).toBe(1);
});

test("native workbench commands return a full rejection through the same factory", async () => {
  const { createWorkbench } = await import("../../core");
  const { createWorkbenchWebviewHostAdapters } = await import("./webview-host-capabilities");
  const { unwrapCommandValue } = await import("../host/command-response");
  const workbench = createWorkbench();
  const outcome = {
    ok: false,
    status: "rejected",
    code: "stale_revision",
    reason: "Changed",
    data: { revision: 2 },
  };
  workbench.commands.registerCommand(
    { id: "save", label: "Save" },
    {
      execute: () => unwrapCommandValue({ outcome }),
    },
  );
  const capabilities = createExtensionWebviewHostCapabilities(createWorkbenchWebviewHostAdapters({ workbench }));
  await expect(capabilities["commands.execute"]({ commandId: "save" })).resolves.toEqual({ outcome });
});

test("workbench adapters route every capability through shared validation or unsupported", async () => {
  const { createWorkbench } = await import("../../core");
  const { createWorkbenchWebviewHostAdapters } = await import("./webview-host-capabilities");
  const capabilities = createExtensionWebviewHostCapabilities(
    createWorkbenchWebviewHostAdapters({ workbench: createWorkbench() }),
  );
  const supported = new Set([
    "resources.actions",
    "commands.execute",
    "navigation.open",
    "page.params.update",
    "notification.show",
    "preferences.get",
    "preferences.set",
  ]);
  expect(Object.keys(capabilities).sort()).toEqual([...WEBVIEW_HOST_CAPABILITIES].sort());
  for (const name of WEBVIEW_HOST_CAPABILITIES) {
    await expect(Promise.resolve().then(() => capabilities[name](null))).rejects.toMatchObject({
      code: supported.has(name) ? "invalid_params" : "unsupported",
      data: { capability: name },
    });
  }
});

test("settings and preferences preserve saved data through shared result shapes", async () => {
  const overrides = new Map<string, unknown>();
  const preferences = new Map<string, string | boolean | number>();
  const capabilities = createExtensionWebviewHostCapabilities({
    settings: {
      all: () => ({ density: overrides.get("density") ?? "comfortable" }),
      get: (key) => overrides.get(key) ?? "comfortable",
      set: (key, value) => {
        overrides.set(key, value);
        return { value };
      },
      delete: (key) => {
        overrides.delete(key);
      },
    },
    preferences: {
      get: (name) => preferences.get(name),
      set: (name, value, scope) => {
        expect(scope).toEqual({ scope: "user" });
        preferences.set(name, value as string);
      },
    },
  });
  expect(await capabilities["extension.settings.all"]({})).toEqual({ density: "comfortable" });
  expect(await capabilities["extension.settings.set"]({ key: "density", value: "compact" })).toEqual({
    key: "density",
    value: "compact",
  });
  expect(await capabilities["extension.settings.get"]({ key: "density" })).toBe("compact");
  expect(await capabilities["extension.settings.delete"]({ key: "density" })).toBeUndefined();
  expect(await capabilities["extension.settings.get"]({ key: "density" })).toBe("comfortable");
  expect(await capabilities["preferences.set"]({ name: "density", value: "compact" })).toEqual({
    name: "density",
    value: "compact",
  });
  expect(await capabilities["preferences.get"]({ name: "density" })).toBe("compact");
});

test("the shared command owner preserves failures thrown by any host adapter", async () => {
  const { CommandOutcomeError } = await import("@pstdio/sdk/extensions");
  const outcome = {
    ok: false,
    status: "rejected",
    code: "stale_revision",
    reason: "Changed",
    data: { revision: 2 },
    cause: { source: "storage" },
  } as const;
  const capabilities = createExtensionWebviewHostCapabilities({
    executeCommand: () => {
      throw new CommandOutcomeError(outcome);
    },
  });
  await expect(capabilities["commands.execute"]({ commandId: "save" })).resolves.toEqual({ outcome });
});

test("notification resolution preserves empty dedupe keys for both operations", async () => {
  const received: unknown[] = [];
  const capabilities = createExtensionWebviewHostCapabilities({
    notifications: {
      resolve: (request) => {
        received.push(request);
        return { resolved: 0, notifications: [] };
      },
    },
  });
  await capabilities["notification.resolve"]({ dedupeKey: "" });
  await capabilities["notification.dismiss"]({ id: "ignored", dedupeKey: "" });
  expect(received).toEqual([
    { dedupeKey: "", status: "done" },
    { id: "ignored", dedupeKey: "", status: "dismissed" },
  ]);
});

test("disconnect aborts native workbench commands with their resource context", async () => {
  const { createWorkbench } = await import("../../core");
  const { createWorkbenchWebviewHostAdapters } = await import("./webview-host-capabilities");
  const { createHostEventPublisher } = await import("pstdio-extensions/bridge/host");
  const workbench = createWorkbench();
  const events = createHostEventPublisher();
  const started = Promise.withResolvers<void>();
  let captured: { signal?: AbortSignal; resource?: unknown } | undefined;
  workbench.commands.registerCommand(
    { id: "wait", label: "Wait" },
    {
      execute: async (_params, context) => {
        captured = context;
        started.resolve();
        await new Promise<void>((resolve) =>
          context?.signal?.addEventListener("abort", () => resolve(), { once: true }),
        );
        return "stopped";
      },
    },
  );
  const capabilities = createExtensionWebviewHostCapabilities(
    createWorkbenchWebviewHostAdapters({ workbench, hostEvents: events }),
  );
  const pending = capabilities["commands.execute"]({ commandId: "wait", resource: { type: "note", id: "1" } });
  await started.promise;
  expect(captured?.resource).toEqual({ type: "note", id: "1" });
  expect(captured?.signal).toBeInstanceOf(AbortSignal);
  events.unbind();
  expect(captured?.signal?.aborted).toBe(true);
  expect(await pending).toMatchObject({ outcome: { ok: true, value: "stopped" } });
});

test("notification optional fields are checked before invoking any host service", async () => {
  let calls = 0;
  const capabilities = createExtensionWebviewHostCapabilities({
    notifications: {
      create: async () => {
        calls++;
        throw new Error("Unexpected service call");
      },
    },
  });
  for (const input of [
    { priority: "invalid" },
    { body: {} },
    { related: "invalid" },
    { actions: [{ kind: "command", id: "go", label: "Go", command: 1 }] },
  ]) {
    await expect(
      Promise.resolve().then(() => capabilities["notification.action"]({ title: "Review", kind: "info", ...input })),
    ).rejects.toMatchObject({ code: "invalid_params", data: { capability: "notification.action" } });
  }
  expect(calls).toBe(0);
});

test("notification validation keeps all supported legacy fields", async () => {
  let received: unknown;
  const capabilities = createExtensionWebviewHostCapabilities({
    notifications: {
      create: (notice) => {
        received = notice;
        return {
          ...notice,
          id: "n1",
          projectId: "project",
          status: "open",
          priority: notice.priority ?? "normal",
          source: "dashboard",
          origin: "extension",
          related: notice.related ?? [],
          actions: notice.actions ?? [],
          createdAt: "now",
          updatedAt: "now",
        };
      },
    },
  });
  const input = {
    title: "Review",
    kind: "info",
    body: "Details",
    priority: "high",
    target: { type: "note", id: "1" },
    related: [{ type: "note", id: "2" }],
    actions: [{ kind: "url", id: "open", label: "Open", href: "https://example.com", primary: true }],
    dedupeKey: "",
    expiresAt: "later",
    snoozedUntil: "later",
    metadata: { revision: 2 },
  };
  await capabilities["notification.action"](input);
  expect(received).toEqual(input);
});

test("canonical and deprecated toast inputs use one command notice shape", async () => {
  const notices: unknown[] = [];
  const capabilities = createExtensionWebviewHostCapabilities({
    notifications: {
      show: (notice) => {
        notices.push(notice);
      },
    },
  });
  await capabilities["notification.show"]({ type: "success", message: "Saved", metadata: { revision: 2 } });
  await capabilities["notification.show"]({ level: "warning", title: "Review", message: "Changed" });
  await capabilities["notification.show"]({ level: "info", title: "Ready" });
  expect(notices).toEqual([
    { type: "success", message: "Saved", metadata: { revision: 2 } },
    { type: "warning", title: "Review", message: "Changed" },
    { type: "info", title: "Ready", message: "" },
  ]);
});

test("setting write results use the saved value instead of echoing the input", async () => {
  const values = new Map<string, unknown>();
  const capabilities = createExtensionWebviewHostCapabilities({
    settings: {
      all: () => Object.fromEntries(values),
      get: (key) => values.get(key),
      set: (key, value) => {
        const saved = Math.min(Number(value), 4);
        values.set(key, saved);
        return { value: saved };
      },
      delete: (key) => {
        values.delete(key);
      },
    },
  });
  expect(await capabilities["extension.settings.set"]({ key: "columns", value: 5 })).toEqual({
    key: "columns",
    value: 4,
  });
  expect(await capabilities["extension.settings.get"]({ key: "columns" })).toBe(4);
});

test("account capabilities route reads and changes to the host account and validate operations", async () => {
  const calls: unknown[][] = [];
  const record =
    (name: string, result?: unknown) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args]);
      return result as never;
    };
  const capabilities = createExtensionWebviewHostCapabilities({
    account: {
      status: record("status"),
      login: record("login"),
      loginStatus: record("loginStatus"),
      cancelLogin: record("cancelLogin"),
      logout: record("logout"),
      devices: record("devices"),
      renameDevice: record("renameDevice"),
      removeDevice: record("removeDevice"),
      projectSyncStatus: record("projectSyncStatus", { state: "synced", offlineReady: true }),
      syncProject: record("syncProject"),
      stopProjectSync: record("stopProjectSync"),
    },
  });

  expect(await capabilities["account.read"]({ op: "projectSyncStatus" })).toEqual({
    state: "synced",
    offlineReady: true,
  });
  await capabilities["account.manage"]({ op: "renameDevice", id: "device-2", name: "Studio Mac" });
  await capabilities["account.manage"]({ op: "stopProjectSync", projectId: "project-2" });
  await capabilities["account.manage"]({ op: "login" });
  await capabilities["account.manage"]({ op: "login", managerOrigin: "https://accounts.example.test" });
  expect(calls).toEqual([
    ["projectSyncStatus", undefined],
    ["renameDevice", "device-2", "Studio Mac"],
    ["stopProjectSync", "project-2"],
    ["login", undefined],
    ["login", "https://accounts.example.test"],
  ]);
  // Reads cannot change the account, and changes need their own capability.
  await expect(Promise.resolve().then(() => capabilities["account.read"]({ op: "logout" }))).rejects.toMatchObject({
    code: "invalid_params",
  });
  await expect(Promise.resolve().then(() => capabilities["account.manage"]({ op: "devices" }))).rejects.toMatchObject({
    code: "invalid_params",
  });
  expect(calls).toHaveLength(5);
});

test("text editing validates scoped operations before passing them to the host adapter", async () => {
  const calls: unknown[] = [];
  const capabilities = createExtensionWebviewHostCapabilities({
    textEditing: {
      request: async (input) => {
        calls.push(input);
        return { token: "selected" } as never;
      },
    },
  });
  expect(await capabilities["editing.text"]({ operation: "current" })).toEqual({ token: "selected" });
  await expect(
    Promise.resolve().then(() => capabilities["editing.text"]({ operation: "current", extensionId: "foreign.owner" })),
  ).rejects.toMatchObject({ code: "invalid_params" });
  expect(calls).toEqual([{ operation: "current" }]);
});
