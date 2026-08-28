import { describe, expect, test } from "bun:test";
import * as contractTypes from "pstdio-api-contracts/extension-kernel";
import {
  ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES,
  createHostCapabilityGate,
  validateWebviewCapabilityNames,
  WEBVIEW_DECLARABLE_CAPABILITIES,
  WEBVIEW_HOST_CAPABILITY_VERSION,
  WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES,
} from "./capabilities";

// The contracts package repeats these lists as the public type source. A mismatch
// type-checks fine and only fails at runtime, so assert they stay identical.
describe("capability list sync with pstdio-api-contracts", () => {
  test("matches the contract package lists", () => {
    expect(WEBVIEW_DECLARABLE_CAPABILITIES).toEqual(contractTypes.WEBVIEW_DECLARABLE_CAPABILITIES);
    expect(WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES).toEqual(contractTypes.WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES);
    expect(ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES).toEqual(contractTypes.ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES);
  });
});

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

  test("accepts terminal session declarations", () => {
    expect(validateWebviewCapabilityNames(["terminal.session"])).toEqual([]);
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

  test("allows artifact reads only for declared mounts", async () => {
    const diagnostics: unknown[] = [];
    const gate = createHostCapabilityGate({
      capabilities: {
        "artifacts.read": async (params) => ({ params }),
      },
      declaredCapabilities: ["artifacts.read:runs", `artifacts.read:reports@${WEBVIEW_HOST_CAPABILITY_VERSION}`],
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    await expect(
      gate.call({ method: "artifacts.read", params: { op: "list", mount: "runs", prefix: "a/" } }),
    ).resolves.toEqual({ params: { op: "list", mount: "runs", prefix: "a/" } });
    await expect(
      gate.call({ method: "artifacts.read", params: { op: "readText", mount: "reports", path: "r.json" } }),
    ).resolves.toEqual({ params: { op: "readText", mount: "reports", path: "r.json" } });
    expect(gate.diagnostics).toEqual([]);

    // The denial names the exact missing declaration.
    await expect(
      gate.call({ method: "artifacts.read", params: { op: "readText", mount: "secrets", path: "s.txt" } }),
    ).rejects.toThrow("Webview did not declare host capability: artifacts.read:secrets");
    expect(diagnostics).toMatchObject([
      {
        capability: "artifacts.read:secrets",
        code: "undeclared_webview_capability",
        severity: "error",
      },
    ]);
  });

  test("rejects artifact reads without a mount param", async () => {
    const gate = createHostCapabilityGate({
      capabilities: {
        "artifacts.read": async () => [],
      },
      declaredCapabilities: ["artifacts.read:runs"],
    });

    await expect(gate.call({ method: "artifacts.read", params: { op: "list" } })).rejects.toThrow(
      "Unsupported webview capability: artifacts.read",
    );
  });

  test("rejects bare and misplaced scope declarations", () => {
    expect(validateWebviewCapabilityNames(["artifacts.read"])).toMatchObject([
      { capability: "artifacts.read", code: "unsupported_webview_capability" },
    ]);
    expect(validateWebviewCapabilityNames(["files.list:runs"])).toMatchObject([
      { capability: "files.list:runs", code: "unsupported_webview_capability" },
    ]);
    expect(validateWebviewCapabilityNames(["artifacts.read:runs", "artifacts.read:reports@1"])).toEqual([]);
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
