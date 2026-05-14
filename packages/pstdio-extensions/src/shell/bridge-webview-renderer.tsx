import {
  BRIDGE_WEBVIEW_RENDERER_ID,
  type ShellCore,
  type ShellRendererRegistration,
  type ShellWidgetRenderInput,
} from "pstdio-shell/core";
import type { WebviewCapabilityDiagnostic } from "../bridge/contract";
import { ExtensionFrame } from "../bridge/host";
import { createShellWebviewHostCapabilities } from "./webview-host-capabilities";

const renderBridgeWebview = (input: ShellWidgetRenderInput) => {
  const { shell, widget, placement } = input;
  const webview = widget.webview;
  if (!webview) return null;

  return (
    <ExtensionFrame
      view={{
        extensionId: widget.ownerId,
        id: placement.contributionId,
        label: webview.title ?? widget.title,
        webview: {
          capabilities: webview.capabilities,
          moduleUrl: webview.moduleUrl ?? "",
          runtimeUrl: webview.runtimeUrl ?? "",
          styles: webview.styles ?? [],
        },
      }}
      props={{ placement, resource: placement.resource }}
      theme="light"
      capabilities={createShellWebviewHostCapabilities({ shell, webviewId: placement.contributionId })}
      onDiagnostics={(diagnostics) => reportWebviewDiagnostics(shell, placement.contributionId, diagnostics)}
      onError={(error) => reportWebviewError(shell, placement.contributionId, error.message)}
    />
  );
};

export const createBridgeWebviewRenderer = () =>
  ({
    id: BRIDGE_WEBVIEW_RENDERER_ID,
    render: renderBridgeWebview,
  }) satisfies ShellRendererRegistration;

const reportWebviewDiagnostics = (shell: ShellCore, webviewId: string, diagnostics: WebviewCapabilityDiagnostic[]) => {
  for (const diagnostic of diagnostics) {
    shell.diagnostics.report({
      code: diagnostic.code,
      id: `${webviewId}.${diagnostic.code}.${diagnostic.capability}`,
      message: diagnostic.message,
      metadata: { capability: diagnostic.capability, webviewId },
      severity: diagnostic.severity,
      source: "shell.webview",
    });
  }
};

const reportWebviewError = (shell: ShellCore, webviewId: string, message: string) => {
  shell.diagnostics.report({
    code: "webview_runtime_error",
    id: `${webviewId}.runtime-error`,
    message,
    metadata: { webviewId },
    severity: "error",
    source: "shell.webview",
  });
};
