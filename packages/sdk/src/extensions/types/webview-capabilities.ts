import type { JsonObject } from "./json";
import type { RepoContext, ResourceRef } from "./resources";

export const WEBVIEW_HOST_CAPABILITY_VERSION = 1;

// Capabilities a webview must declare in its manifest before the bridge will route them.
export const WEBVIEW_DECLARABLE_CAPABILITIES = [
  "commands.execute",
  "resource.open",
  "notification.show",
  "preferences.get",
  "preferences.set",
] as const;

// Runtime plumbing the guest invokes on its own (e.g. keyboard forwarding). Enabled
// wherever the host implements them, with no manifest declaration required.
export const ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES = ["host.dispatchKeyboardEvent"] as const;

export const WEBVIEW_HOST_CAPABILITIES = [
  ...WEBVIEW_DECLARABLE_CAPABILITIES,
  ...ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES,
] as const;

export type WebviewHostCapability = (typeof WEBVIEW_HOST_CAPABILITIES)[number];
export type WebviewDeclarableCapability = (typeof WEBVIEW_DECLARABLE_CAPABILITIES)[number];
export type WebviewCapabilityDeclaration =
  | WebviewDeclarableCapability
  | `${WebviewDeclarableCapability}@${typeof WEBVIEW_HOST_CAPABILITY_VERSION}`;

export interface WebviewCommandsExecuteParams {
  commandId: string;
  params?: JsonObject;
  resource?: ResourceRef;
  repo?: RepoContext;
  metadata?: JsonObject;
}

export interface WebviewResourceOpenParams {
  href?: string;
  resource?: ResourceRef;
  input?: {
    replaceActive?: boolean;
  };
}

export interface WebviewNotificationShowParams {
  level: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
}

export interface WebviewPreferencesGetParams {
  name: string;
  scope?: {
    scope: "default" | "user" | "project" | "repo" | "workspace" | "extension" | "session";
    scopeId?: string;
  };
}

export interface WebviewPreferencesSetParams extends WebviewPreferencesGetParams {
  value: boolean | number | string | string[] | number[] | boolean[] | Record<string, unknown>;
}

export interface WebviewKeyboardEventParams {
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
}

export interface WebviewHostCapabilityParams {
  "commands.execute": WebviewCommandsExecuteParams;
  "resource.open": WebviewResourceOpenParams;
  "notification.show": WebviewNotificationShowParams;
  "preferences.get": WebviewPreferencesGetParams;
  "preferences.set": WebviewPreferencesSetParams;
  "host.dispatchKeyboardEvent": WebviewKeyboardEventParams;
}
