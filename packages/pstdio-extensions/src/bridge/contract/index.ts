export const HOST_READY_EVENT = "pstdio.extension.ready";
export const HOST_RUNTIME_ERROR_EVENT = "pstdio.extension.runtime-error";

export type ThemePreference = "dark" | "light";

export type InitMessage = {
  moduleUrl: string;
  styles: string[];
  props: unknown;
  theme: ThemePreference;
  themeVariables: Record<string, string>;
};

export type ThemeUpdateMessage = {
  theme: ThemePreference;
  variables: Record<string, string>;
};

export type PropsUpdateMessage = {
  props: unknown;
};

export type ReadyPayload = {
  meta?: Record<string, unknown>;
};

export type RuntimeErrorPayload = {
  message: string;
  stack?: string;
};

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
  ready: (payload: ReadyPayload) => void;
  runtimeError: (payload: RuntimeErrorPayload) => void;
  call: (request: HostCapabilityRequest) => Promise<unknown>;
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
