import type { TerminalSessionOperation } from "../../extensions.terminal";
import type { CreateNotificationInput, NotificationStatus } from "../../notifications/types";
import type { JsonObject } from "./json";
import type { RepoContext, ResourceRef } from "./resources";

export type { ExtensionBlobRef } from "./context";

export const WEBVIEW_HOST_CAPABILITY_VERSION = 1;

// Capabilities a webview must declare in its manifest before the bridge will route them.
export const WEBVIEW_DECLARABLE_CAPABILITIES = [
  "commands.execute",
  "resource.open",
  "notification.show",
  "notification.action",
  "notification.resolve",
  "notification.dismiss",
  "preferences.get",
  "preferences.set",
  "extension.settings.all",
  "extension.settings.get",
  "extension.settings.set",
  "extension.settings.delete",
  "terminal.session",
  "files.upload",
  "files.list",
  "files.delete",
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

export type WebviewNotificationActionParams = Omit<CreateNotificationInput, "projectId">;
export interface WebviewNotificationResolveParams {
  id?: string;
  dedupeKey?: string;
  status?: Extract<NotificationStatus, "done" | "dismissed" | "expired">;
}
export type WebviewNotificationDismissParams = Pick<WebviewNotificationResolveParams, "id" | "dedupeKey">;

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

export interface WebviewExtensionSettingKeyParams {
  key: string;
}

export interface WebviewExtensionSettingSetParams extends WebviewExtensionSettingKeyParams {
  value: unknown;
}

export type WebviewFileScope =
  | { type: "project" }
  | { type: "repo"; id: string }
  | { type: "resource"; id: string }
  | { type: string; id?: string };

export interface WebviewFilesUploadParams {
  name: string;
  data: Uint8Array | ArrayBuffer;
  mimeType?: string;
  scope?: WebviewFileScope;
}

export interface WebviewFilesListParams {
  scope?: WebviewFileScope;
}

export interface WebviewFilesDeleteParams {
  id: string;
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
  "notification.action": WebviewNotificationActionParams;
  "notification.resolve": WebviewNotificationResolveParams;
  "notification.dismiss": WebviewNotificationDismissParams;
  "preferences.get": WebviewPreferencesGetParams;
  "preferences.set": WebviewPreferencesSetParams;
  "extension.settings.all": Record<string, never>;
  "extension.settings.get": WebviewExtensionSettingKeyParams;
  "extension.settings.set": WebviewExtensionSettingSetParams;
  "extension.settings.delete": WebviewExtensionSettingKeyParams;
  "terminal.session": TerminalSessionOperation;
  "files.upload": WebviewFilesUploadParams;
  "files.list": WebviewFilesListParams;
  "files.delete": WebviewFilesDeleteParams;
  "host.dispatchKeyboardEvent": WebviewKeyboardEventParams;
}
