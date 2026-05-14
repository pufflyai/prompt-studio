import type { JsonObject } from "./json";
import type { RepoContext, ResourceRef } from "./resources";

export const WEBVIEW_HOST_CAPABILITY_VERSION = 1;

export const WEBVIEW_HOST_CAPABILITIES = [
  "commands.execute",
  "resource.open",
  "notification.show",
  "preferences.get",
  "preferences.set",
  "activity.emit",
  "diagnostics.report",
  "host.dispatchKeyboardEvent",
] as const;

export type WebviewHostCapability = (typeof WEBVIEW_HOST_CAPABILITIES)[number];
export type WebviewCapabilityDeclaration =
  | WebviewHostCapability
  | `${WebviewHostCapability}@${typeof WEBVIEW_HOST_CAPABILITY_VERSION}`;

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

export interface WebviewActivityEmitParams {
  id: string;
  kind: string;
  title: string;
  message?: string;
  severity?: "info" | "success" | "warning" | "error";
  createdAt: string;
  resource?: ResourceRef;
  metadata?: Record<string, unknown>;
}

export interface WebviewDiagnosticsReportParams {
  id: string;
  source: string;
  severity: "error" | "warning" | "info";
  message: string;
  resource?: ResourceRef;
  code?: string;
  metadata?: Record<string, unknown>;
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
  "activity.emit": WebviewActivityEmitParams;
  "diagnostics.report": WebviewDiagnosticsReportParams;
  "host.dispatchKeyboardEvent": WebviewKeyboardEventParams;
}
