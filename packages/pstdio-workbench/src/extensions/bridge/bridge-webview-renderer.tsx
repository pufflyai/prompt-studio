import type { WebviewHostProps } from "pstdio-api-contracts/extension-kernel";
import type { ThemePreference } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher, type HostEventPublisher } from "pstdio-extensions/bridge/host";
import type {
  WorkbenchCore,
  WorkbenchPanelInstance,
  WorkbenchPanelRenderInput,
  WorkbenchRendererRegistration,
} from "../../core";
import { BridgeWebviewFrame } from "./bridge-webview-frame";
import type { ExtensionWebviewHostAdapters } from "./extension-webview-host-adapters";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";
import { createWorkbenchWebviewHostAdapters } from "./webview-host-capabilities";

export interface BridgeWebviewRenderContext {
  workbench: WorkbenchCore;
  webviewId: string;
  extensionId?: string;
  placement: WorkbenchPanelInstance;
  /** Channel for pushing host events (e.g. terminal output) into this webview. */
  hostEvents: HostEventPublisher;
}

// Hosts supply services. The shared factory owns capability routing, validation and results.
export type CreateBridgeWebviewHostAdapters = (context: BridgeWebviewRenderContext) => ExtensionWebviewHostAdapters;

// What the host pushes into the guest's props store. Hosts inject this to forward dynamic
// data — e.g. the dashboard forwards extension command outcomes and theme preference.
export type CreateBridgeWebviewProps = (
  context: BridgeWebviewRenderContext,
) => Partial<WebviewHostProps> & Record<string, unknown>;
export type CreateBridgeWebviewTheme = (context: BridgeWebviewRenderContext) => ThemePreference;

interface CreateBridgeWebviewRendererInput {
  createHostAdapters?: CreateBridgeWebviewHostAdapters;
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

export const getBridgeWebviewHostEventPublisher = (workbench: WorkbenchCore, instance: WorkbenchPanelInstance) => {
  let hostEventsByWidget = hostEventPublishersByWorkbench.get(workbench);
  if (!hostEventsByWidget) {
    hostEventsByWidget = new Map();
    hostEventPublishersByWorkbench.set(workbench, hostEventsByWidget);
  }

  const key = instance.instanceId;
  let hostEvents = hostEventsByWidget.get(key);
  if (!hostEvents) {
    hostEvents = createHostEventPublisher();
    hostEventsByWidget.set(key, hostEvents);
  }

  return hostEvents;
};

export const renderBridgeWebviewFrame = (input: {
  sizing?: "content-width" | "content-height";
  context: BridgeWebviewRenderContext;
  createHostAdapters: CreateBridgeWebviewHostAdapters;
  createProps: CreateBridgeWebviewProps;
  createTheme?: CreateBridgeWebviewTheme;
  ownerId?: string;
  title: string;
  webview: BridgeWebviewConfig;
}) => {
  const { context, createHostAdapters, createProps, createTheme = createLightTheme, ownerId, title, webview } = input;
  return (
    <BridgeWebviewFrame
      sizing={input.sizing}
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
      workbench={context.workbench}
      theme={createTheme(context)}
      capabilities={createExtensionWebviewHostCapabilities(
        createHostAdapters({ ...context, extensionId: ownerId ?? context.extensionId }),
      )}
      hostEvents={context.hostEvents}
    />
  );
};

const renderBridgeWebview = (
  input: WorkbenchPanelRenderInput,
  createHostAdapters: CreateBridgeWebviewHostAdapters,
  createProps: CreateBridgeWebviewProps,
  createTheme: CreateBridgeWebviewTheme,
) => {
  const { workbench, panel, instance } = input;
  const webview = isBridgeWebviewConfig(panel.config) ? panel.config : null;
  if (!webview) return null;

  return renderBridgeWebviewFrame({
    sizing: panel.region === "status" ? "content-width" : undefined,
    context: {
      workbench,
      webviewId: instance.panelId,
      placement: instance,
      hostEvents: getBridgeWebviewHostEventPublisher(workbench, instance),
    },
    createHostAdapters,
    createProps,
    createTheme,
    ownerId: "ownerId" in panel ? panel.ownerId : undefined,
    title: panel.title,
    webview,
  });
};

export const createBridgeWebviewRenderer = (input: CreateBridgeWebviewRendererInput = {}) => {
  const createHostAdapters = input.createHostAdapters ?? createWorkbenchWebviewHostAdapters;
  const createProps = input.createProps ?? createPlacementProps;
  const createTheme = input.createTheme ?? createLightTheme;

  return {
    id: BRIDGE_WEBVIEW_RENDERER_ID,
    render: (renderInput) => renderBridgeWebview(renderInput, createHostAdapters, createProps, createTheme),
  } satisfies WorkbenchRendererRegistration;
};
