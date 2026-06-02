import { describe, expect, test } from "bun:test";
import { createHostCapabilityGate, WEBVIEW_HOST_CAPABILITY_VERSION } from "./capabilities";

describe("createHostCapabilityGate", () => {
  test("allows declared v1 capabilities", async () => {
    const calls: unknown[] = [];
    const gate = createHostCapabilityGate({
      capabilities: {
        "commands.execute": async (params) => {
          calls.push(params);
          return { ok: true };
        },
      },
      declaredCapabilities: [`commands.execute@${WEBVIEW_HOST_CAPABILITY_VERSION}`],
    });

    await expect(gate.call({ method: "commands.execute", params: { commandId: "lab.hello" } })).resolves.toEqual({
      ok: true,
    });
    expect(calls).toEqual([{ commandId: "lab.hello" }]);
    expect(gate.diagnostics).toEqual([]);
  });

  test("allows declared file capabilities", async () => {
    const gate = createHostCapabilityGate({
      capabilities: {
        "files.upload": async () => ({ id: "file-1" }),
        "files.list": async () => [],
        "files.delete": async () => undefined,
      },
      declaredCapabilities: ["files.upload", "files.list", "files.delete"],
    });

    await expect(gate.call({ method: "files.upload", params: { name: "a.txt" } })).resolves.toEqual({ id: "file-1" });
    await expect(gate.call({ method: "files.list", params: {} })).resolves.toEqual([]);
    await expect(gate.call({ method: "files.delete", params: { id: "file-1" } })).resolves.toBeUndefined();
    expect(gate.diagnostics).toEqual([]);
  });

  test("enables always-available capabilities without a declaration", async () => {
    const dispatched: unknown[] = [];
    const gate = createHostCapabilityGate({
      capabilities: {
        "host.dispatchKeyboardEvent": (params) => {
          dispatched.push(params);
        },
      },
      declaredCapabilities: [],
    });

    await expect(gate.call({ method: "host.dispatchKeyboardEvent", params: { key: "p" } })).resolves.toBeUndefined();
    expect(dispatched).toEqual([{ key: "p" }]);
    expect(gate.diagnostics).toEqual([]);
  });

  test("rejects undeclared capability calls", async () => {
    const diagnostics: unknown[] = [];
    const gate = createHostCapabilityGate({
      capabilities: {
        "commands.execute": async () => ({ ok: true }),
      },
      declaredCapabilities: [],
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    await expect(gate.call({ method: "commands.execute", params: { commandId: "lab.hello" } })).rejects.toThrow(
      "Webview did not declare host capability: commands.execute",
    );
    expect(diagnostics).toMatchObject([
      {
        capability: "commands.execute",
        code: "undeclared_webview_capability",
        severity: "error",
      },
    ]);
  });

  test("reports unsupported capability declarations", () => {
    const gate = createHostCapabilityGate({
      capabilities: {
        "commands.execute": async () => ({ ok: true }),
      },
      declaredCapabilities: ["commands.execute@2", "shell.escape", "resource.open"],
    });

    expect(gate.diagnostics).toMatchObject([
      {
        capability: "commands.execute@2",
        code: "unsupported_webview_capability_version",
        severity: "error",
      },
      {
        capability: "shell.escape",
        code: "unsupported_webview_capability",
        severity: "error",
      },
      {
        capability: "resource.open",
        code: "unsupported_webview_capability",
        severity: "error",
      },
    ]);
  });
});
