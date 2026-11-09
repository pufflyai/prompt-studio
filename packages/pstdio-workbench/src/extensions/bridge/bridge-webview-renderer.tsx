import type { NativeDocumentTarget } from "pstdio-api-contracts";
import type { WebviewHostProps } from "pstdio-api-contracts/extension-kernel";
import type { ThemePreference } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher, type HostEventPublisher } from "pstdio-extensions/bridge/host";
import type {
  WorkbenchCore,
  WorkbenchPanelInstance,
  WorkbenchPanelRenderInput,
  WorkbenchRendererRegistration,
} from "../../core";
import { watchClosedTerminalPlacements } from "../../react/terminal/watch-terminal-placements";
import { BridgeWebviewFrame } from "./bridge-webview-frame";
import type { ExtensionWebviewHostAdapters } from "./extension-webview-host-adapters";
import {
  createExtensionWebviewHostCapabilities,
  disposeWebviewTerminalOwner,
} from "./extension-webview-host-capabilities";
import { createWorkbenchWebviewHostAdapters } from "./webview-host-capabilities";

export interface BridgeWebviewRenderContext {
  workbench: WorkbenchCore;
  webviewId: string;
  extensionId?: string;
  placement: WorkbenchPanelInstance;
  textTarget?: NativeDocumentTarget;
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

interface WebviewPublisherOwner {
  hostEvents: HostEventPublisher;
  projectId?: string;
  viewId: string;
  dispose(): void;
}
const hostEventPublishersByWorkbench = new WeakMap<object, Map<string, WebviewPublisherOwner>>();

export const reconcileBridgeWebviewHostEventPublishers = (
  workbench: { layout: Pick<WorkbenchCore["layout"], "store"> },
  projectId: string,
  viewIds: ReadonlySet<string>,
) => {
  for (const owner of hostEventPublishersByWorkbench.get(workbench.layout.store)?.values() ?? []) {
    if (owner.projectId === projectId && !viewIds.has(owner.viewId)) owner.dispose();
  }
};

export const getBridgeWebviewHostEventPublisher = (
  workbench: WorkbenchCore,
  instance: WorkbenchPanelInstance,
  projectId = workbench.pages.store.getState().projectId ?? undefined,
) => {
  let owners = hostEventPublishersByWorkbench.get(workbench.layout.store);
  if (!owners) {
    owners = new Map();
    hostEventPublishersByWorkbench.set(workbench.layout.store, owners);
  }
  const key = JSON.stringify([projectId, instance.instanceId]);
  const retained = owners.get(key);
  if (retained) return retained.hostEvents;
  const hostEvents = createHostEventPublisher();
  const viewId = instance.viewId ?? instance.panelId;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposeWebviewTerminalOwner(hostEvents);
    hostEvents.unbind();
    owners.delete(key);
    watch.dispose();
  };
  const watch = watchClosedTerminalPlacements(workbench, viewId, undefined, projectId, (closedId) => {
    if (closedId === instance.instanceId) dispose();
  });
  owners.set(key, { hostEvents, projectId, viewId, dispose });
  return hostEvents;
};

export const renderBridgeWebviewFrame = (input: {
  visible?: boolean;
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
      visible={input.visible}
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
      props={{
        resource: context.placement.resource,
        ...createProps(context),
        presentation: context.workbench.layout
          .getLayout()
          .regions.overlay.widgets.some((item) => item.widgetId === context.placement.instanceId)
          ? "dialog"
          : undefined,
        viewLocation: {
          section: context.placement.section,
          position: context.placement.position,
          pageContext: context.placement.pageContext,
        },
      }}
      workbench={context.workbench}
      theme={createTheme(context)}
      capabilities={createExtensionWebviewHostCapabilities(
        createHostAdapters({ ...context, extensionId: ownerId ?? context.extensionId }),
        JSON.stringify([
          context.workbench.pages.store.getState().projectId,
          ownerId ?? context.extensionId,
          context.webviewId,
          webview.runtimeUrl,
          webview.moduleUrl,
        ]),
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
    visible: input.visible,
    sizing: input.sizing ?? (panel.region === "status" ? "content-width" : undefined),
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
