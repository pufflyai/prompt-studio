import type {
  WorkbenchCore,
  WorkbenchRendererRegistration,
  WorkbenchWidgetPlacement,
  WorkbenchWidgetRenderInput,
} from "pstdio-workbench/core";
import type { HostCapabilityRegistry, WebviewCapabilityDiagnostic } from "../bridge/contract";
import { ExtensionFrame } from "../bridge/host";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

const logWebviewDiagnostics = (webviewId: string, diagnostics: WebviewCapabilityDiagnostic[]) => {
  for (const diagnostic of diagnostics) {
    console.warn(`[workbench.webview:${webviewId}] ${diagnostic.code}/${diagnostic.capability}: ${diagnostic.message}`);
  }
};

const logWebviewError = (webviewId: string, message: string) => {
  console.error(`[workbench.webview:${webviewId}] runtime error: ${message}`);
};

export interface BridgeWebviewRenderContext {
  workbench: WorkbenchCore;
  webviewId: string;
  placement: WorkbenchWidgetPlacement;
}

// How guest capability calls reach the host. Hosts inject this to swap the workbench-native
// wiring for their own — e.g. the dashboard routes `commands.execute` through its REST API.
export type CreateBridgeWebviewHostCapabilities = (context: BridgeWebviewRenderContext) => HostCapabilityRegistry;

// What the host pushes into the guest's props store. Hosts inject this to forward dynamic
// data — e.g. the dashboard forwards extension command outcomes and theme preference.
export type CreateBridgeWebviewProps = (context: BridgeWebviewRenderContext) => unknown;

interface CreateBridgeWebviewRendererInput {
  createHostCapabilities?: CreateBridgeWebviewHostCapabilities;
  createProps?: CreateBridgeWebviewProps;
}

export const BRIDGE_WEBVIEW_RENDERER_ID = "webview:bridge";

export interface BridgeWebviewConfig {
  title?: string;
  runtimeUrl: string;
  moduleUrl: string;
  styles?: string[];
  capabilities?: string[];
}

const isBridgeWebviewConfig = (value: unknown): value is BridgeWebviewConfig => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const config = value as Partial<BridgeWebviewConfig>;
  return typeof config.runtimeUrl === "string" && typeof config.moduleUrl === "string";
};

const createPlacementProps: CreateBridgeWebviewProps = ({ placement }) => ({
  placement,
  resource: placement.resource,
});

const renderBridgeWebview = (
  input: WorkbenchWidgetRenderInput,
  createHostCapabilities: CreateBridgeWebviewHostCapabilities,
  createProps: CreateBridgeWebviewProps,
) => {
  const { workbench, widget, placement } = input;
  const webview = isBridgeWebviewConfig(widget.config) ? widget.config : null;
  if (!webview) return null;

  const context: BridgeWebviewRenderContext = { workbench, webviewId: placement.contributionId, placement };

  return (
    <ExtensionFrame
      view={{
        extensionId: widget.ownerId,
        id: placement.contributionId,
        label: webview.title ?? widget.title,
        webview: {
          capabilities: webview.capabilities,
          moduleUrl: webview.moduleUrl,
          runtimeUrl: webview.runtimeUrl,
          styles: webview.styles ?? [],
        },
      }}
      props={createProps(context)}
      theme="light"
      capabilities={createHostCapabilities(context)}
      onDiagnostics={(diagnostics) => logWebviewDiagnostics(placement.contributionId, diagnostics)}
      onError={(error) => logWebviewError(placement.contributionId, error.message)}
    />
  );
};

export const createBridgeWebviewRenderer = (input: CreateBridgeWebviewRendererInput = {}) => {
  const createHostCapabilities = input.createHostCapabilities ?? createWorkbenchWebviewHostCapabilities;
  const createProps = input.createProps ?? createPlacementProps;

  return {
    id: BRIDGE_WEBVIEW_RENDERER_ID,
    render: (renderInput) => renderBridgeWebview(renderInput, createHostCapabilities, createProps),
  } satisfies WorkbenchRendererRegistration;
};
