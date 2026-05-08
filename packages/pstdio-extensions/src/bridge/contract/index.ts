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

export type HostApi = {
  init: (message: InitMessage) => Promise<void>;
  themeUpdate: (message: ThemeUpdateMessage) => void;
  propsUpdate: (message: PropsUpdateMessage) => void;
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
  };
};

export type HostCapability<TParams = unknown, TResult = unknown> = (params: TParams) => Promise<TResult> | TResult;

export type HostCapabilityRegistry = Record<string, HostCapability>;
