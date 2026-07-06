import type {
  HostCapabilityRegistry,
  ThemePreference,
  WebviewCapabilityDiagnostic,
} from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher, ExtensionFrame, type HostEventPublisher } from "pstdio-extensions/bridge/host";
import type {
  WorkbenchCore,
  WorkbenchRendererRegistration,
  WorkbenchWidgetPlacement,
  WorkbenchWidgetRenderInput,
} from "../../core";
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
  /** Channel for pushing host events (e.g. terminal output) into this webview. */
  hostEvents: HostEventPublisher;
}

// How guest capability calls reach the host. Hosts inject this to swap the workbench-native
// wiring for their own — e.g. the dashboard routes `commands.execute` through its REST API.
export type CreateBridgeWebviewHostCapabilities = (context: BridgeWebviewRenderContext) => HostCapabilityRegistry;

// What the host pushes into the guest's props store. Hosts inject this to forward dynamic
// data — e.g. the dashboard forwards extension command outcomes and theme preference.
export type CreateBridgeWebviewProps = (context: BridgeWebviewRenderContext) => unknown;
export type CreateBridgeWebviewTheme = (context: BridgeWebviewRenderContext) => ThemePreference;

interface CreateBridgeWebviewRendererInput {
  createHostCapabilities?: CreateBridgeWebviewHostCapabilities;
  createProps?: CreateBridgeWebviewProps;
  createTheme?: CreateBridgeWebviewTheme;
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

const createLightTheme: CreateBridgeWebviewTheme = () => "light";

const hostEventPublishersByWorkbench = new WeakMap<WorkbenchCore, Map<string, HostEventPublisher>>();

export const getBridgeWebviewHostEventPublisher = (workbench: WorkbenchCore, placement: WorkbenchWidgetPlacement) => {
  let hostEventsByWidget = hostEventPublishersByWorkbench.get(workbench);
  if (!hostEventsByWidget) {
    hostEventsByWidget = new Map();
    hostEventPublishersByWorkbench.set(workbench, hostEventsByWidget);
  }

  const key = placement.widgetId;
  let hostEvents = hostEventsByWidget.get(key);
  if (!hostEvents) {
    hostEvents = createHostEventPublisher();
    hostEventsByWidget.set(key, hostEvents);
  }

  return hostEvents;
};

export const renderBridgeWebviewFrame = (input: {
  context: BridgeWebviewRenderContext;
  createHostCapabilities: CreateBridgeWebviewHostCapabilities;
  createProps: CreateBridgeWebviewProps;
  createTheme?: CreateBridgeWebviewTheme;
  ownerId?: string;
  title: string;
  webview: BridgeWebviewConfig;
}) => {
  const {
    context,
    createHostCapabilities,
    createProps,
    createTheme = createLightTheme,
    ownerId,
    title,
    webview,
  } = input;
  return (
    <ExtensionFrame
      view={{
        extensionId: ownerId ?? "workbench",
        id: context.webviewId,
        label: webview.title ?? title,
        webview: {
          capabilities: webview.capabilities,
          moduleUrl: webview.moduleUrl,
          runtimeUrl: webview.runtimeUrl,
          styles: webview.styles ?? [],
        },
      }}
      props={createProps(context)}
      theme={createTheme(context)}
      capabilities={createHostCapabilities(context)}
      hostEvents={context.hostEvents}
      onDiagnostics={(diagnostics) => logWebviewDiagnostics(context.webviewId, diagnostics)}
      onError={(error) => logWebviewError(context.webviewId, error.message)}
    />
  );
};

const renderBridgeWebview = (
  input: WorkbenchWidgetRenderInput,
  createHostCapabilities: CreateBridgeWebviewHostCapabilities,
  createProps: CreateBridgeWebviewProps,
  createTheme: CreateBridgeWebviewTheme,
) => {
  const { workbench, widget, placement } = input;
  const webview = isBridgeWebviewConfig(widget.config) ? widget.config : null;
  if (!webview) return null;

  return renderBridgeWebviewFrame({
    context: {
      workbench,
      webviewId: placement.contributionId,
      placement,
      hostEvents: getBridgeWebviewHostEventPublisher(workbench, placement),
    },
    createHostCapabilities,
    createProps,
    createTheme,
    ownerId: widget.ownerId,
    title: widget.title,
    webview,
  });
};

export const createBridgeWebviewRenderer = (input: CreateBridgeWebviewRendererInput = {}) => {
  const createHostCapabilities = input.createHostCapabilities ?? createWorkbenchWebviewHostCapabilities;
  const createProps = input.createProps ?? createPlacementProps;
  const createTheme = input.createTheme ?? createLightTheme;

  return {
    id: BRIDGE_WEBVIEW_RENDERER_ID,
    render: (renderInput) => renderBridgeWebview(renderInput, createHostCapabilities, createProps, createTheme),
  } satisfies WorkbenchRendererRegistration;
};
