import { expect, test } from "bun:test";
import { createHostCapabilityGate } from "../contract";
import { createWebviewDiagnostics } from "./host-diagnostics";

test("reports a caught capability denial with view identity before readiness", async () => {
  const messages: string[] = [];
  const logger = createWebviewDiagnostics({ extensionId: "acme.notes", id: "overview" }, (message) =>
    messages.push(message),
  );
  const gate = createHostCapabilityGate({
    capabilities: { "notification.show": () => {} },
    declaredCapabilities: [],
    onDiagnostic: (diagnostic) => logger.onDiagnostics([diagnostic]),
  });
  await gate.call({ method: "notification.show", params: {} }).catch(() => {});
  logger.onReady();
  expect(messages.map((message) => JSON.parse(message.slice(message.indexOf("{"))))).toMatchObject([
    {
      event: "webview-diagnostic",
      extensionId: "acme.notes",
      contributionId: "overview",
      code: "undeclared_webview_capability",
      capability: "notification.show",
    },
    { event: "webview-ready", extensionId: "acme.notes", contributionId: "overview" },
  ]);
});

test("preserves unsupported capability and version diagnostics", () => {
  const messages: string[] = [];
  const logger = createWebviewDiagnostics({ extensionId: "acme.notes", id: "overview" }, (message) =>
    messages.push(message),
  );
  logger.onDiagnostics(
    createHostCapabilityGate({ capabilities: {}, declaredCapabilities: ["notification.show"] }).diagnostics,
  );
  logger.onDiagnostics(
    createHostCapabilityGate({ capabilities: {}, declaredCapabilities: ["notification.show@999"] }).diagnostics,
  );
  expect(messages.map((message) => JSON.parse(message.slice(message.indexOf("{"))).code)).toEqual([
    "unsupported_webview_capability",
    "unsupported_webview_capability_version",
  ]);
});
