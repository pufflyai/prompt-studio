import type { WebviewHostProps } from "pstdio-api-contracts/extension-kernel";

export const HOST_READY_EVENT = "pstdio.extension.ready";
export const HOST_RUNTIME_ERROR_EVENT = "pstdio.extension.runtime-error";

export type ThemePreference = "dark" | "light";

export type InitMessage = {
  sizing?: "content-width";
  moduleUrl: string;
  styles: string[];
  props: WebviewHostProps;
  theme: ThemePreference;
  themeVariables: Record<string, string>;
  /** Id of the extension that owns the view; exposed to the guest as `host.extensionId`. */
  extensionId: string;
};

export type ThemeUpdateMessage = {
  theme: ThemePreference;
  variables: Record<string, string>;
};

export type PropsUpdateMessage = {
  props: WebviewHostProps;
};

export type ReadyPayload = {
  meta?: Record<string, unknown>;
};

export type RuntimeErrorPayload = {
  message: string;
  stack?: string;
};

export type HostCapabilityReply =
  | { ok: true; value: unknown }
  | { ok: false; error: { code: string; message: string; data?: unknown } };

export type HostCapabilityRequest = {
  method: string;
  params?: unknown;
};

// Host-pushed event delivered into a guest webview. `scope` names the capability
// that produced it (e.g. "terminal.session"); guests subscribe per scope.
export type HostEventMessage = {
  scope: string;
  payload: unknown;
};

export type HostApi = {
  init: (message: InitMessage) => Promise<void>;
  themeUpdate: (message: ThemeUpdateMessage) => void;
  propsUpdate: (message: PropsUpdateMessage) => void;
  hostEvent: (message: HostEventMessage) => void;
};

export type GuestApi = {
  contentWidthChanged: (width: number) => void;
  dispatchKeyboardEvent: (event: import("pstdio-api-contracts").WebviewKeyboardEventParams) => Promise<void>;
  ready: (payload: ReadyPayload) => void;
  runtimeError: (payload: RuntimeErrorPayload) => void;
  call: (request: HostCapabilityRequest) => Promise<HostCapabilityReply>;
};

export type ExtensionViewDescriptor = {
  id: string;
  extensionId: string;
  label: string;
  slot?: string;
  target?: string;
  order?: number;
  webview: {
    moduleUrl: string;
    styles: string[];
    runtimeUrl: string;
    capabilities?: string[];
  };
};

export type {
  HostCapability,
  HostCapabilityRegistry,
  WebviewCapabilityDiagnostic,
  WebviewCapabilityDiagnosticCode,
  WebviewDeclarableCapability,
  WebviewHostCapability,
} from "./capabilities";
export {
  ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES,
  createHostCapabilityGate,
  validateWebviewCapabilityDeclarations,
  validateWebviewCapabilityNames,
  WEBVIEW_DECLARABLE_CAPABILITIES,
  WEBVIEW_HOST_CAPABILITIES,
  WEBVIEW_HOST_CAPABILITY_VERSION,
} from "./capabilities";
