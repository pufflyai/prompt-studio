import {
  BRIDGE_WEBVIEW_RENDERER_ID,
  type ShellCore,
  type ShellRendererRegistration,
  type ShellWidgetPlacement,
  type ShellWidgetRenderInput,
} from "pstdio-shell/core";
import type { HostCapabilityRegistry, WebviewCapabilityDiagnostic } from "../bridge/contract";
import { ExtensionFrame } from "../bridge/host";
import { createShellWebviewHostCapabilities } from "./webview-host-capabilities";

export interface BridgeWebviewRenderContext {
  shell: ShellCore;
  webviewId: string;
  placement: ShellWidgetPlacement;
}

// How guest capability calls reach the host. Hosts inject this to swap the shell-native
// wiring for their own — e.g. the dashboard routes `commands.execute` through its REST API.
export type CreateBridgeWebviewHostCapabilities = (context: BridgeWebviewRenderContext) => HostCapabilityRegistry;

// What the host pushes into the guest's props store. Hosts inject this to forward dynamic
// data — e.g. the dashboard forwards extension command outcomes and theme preference.
export type CreateBridgeWebviewProps = (context: BridgeWebviewRenderContext) => unknown;

interface CreateBridgeWebviewRendererInput {
  createHostCapabilities?: CreateBridgeWebviewHostCapabilities;
  createProps?: CreateBridgeWebviewProps;
}

const createPlacementProps: CreateBridgeWebviewProps = ({ placement }) => ({
  placement,
  resource: placement.resource,
});

const renderBridgeWebview = (
  input: ShellWidgetRenderInput,
  createHostCapabilities: CreateBridgeWebviewHostCapabilities,
  createProps: CreateBridgeWebviewProps,
) => {
  const { shell, widget, placement } = input;
  const webview = widget.webview;
  if (!webview) return null;

  const context: BridgeWebviewRenderContext = { shell, webviewId: placement.contributionId, placement };

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
      props={createProps(context)}
      theme="light"
      capabilities={createHostCapabilities(context)}
      onDiagnostics={(diagnostics) => reportWebviewDiagnostics(shell, placement.contributionId, diagnostics)}
      onError={(error) => reportWebviewError(shell, placement.contributionId, error.message)}
    />
  );
};

export const createBridgeWebviewRenderer = (input: CreateBridgeWebviewRendererInput = {}) => {
  const createHostCapabilities = input.createHostCapabilities ?? createShellWebviewHostCapabilities;
  const createProps = input.createProps ?? createPlacementProps;

  return {
    id: BRIDGE_WEBVIEW_RENDERER_ID,
    render: (renderInput) => renderBridgeWebview(renderInput, createHostCapabilities, createProps),
  } satisfies ShellRendererRegistration;
};

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
