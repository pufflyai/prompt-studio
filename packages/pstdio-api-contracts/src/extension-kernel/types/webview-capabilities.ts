import type { AgentInfo, AgentModel, HarnessParamsInfo } from "../../agents";
import type { TerminalSessionOperation, TerminalSessionResult } from "../../extensions.terminal";
import type { CreateNotificationInput, Notification, NotificationStatus } from "../../notifications/types";
import type {
  PerformanceControlRequest,
  PerformanceReadRequest,
  PerformanceReadResult,
} from "../../performance-control";
import type { ExtensionAccountApi } from "./account";
import type { CommandNotice, CommandOutcome } from "./commands";
import type { ExtensionBlobRef } from "./context";
import type { JsonObject, JsonValue } from "./json";
import type { NavigationTarget } from "./navigation-target";
import type { PageLocation, PageParamValue } from "./pages";
import type { ResourceRef } from "./resources";
import type { ExtensionHarnessInput } from "./sessions";
import type { WebviewEditingSessionParams, WebviewEditingSnapshot } from "./webview-editing";

export type { ExtensionBlobRef } from "./context";

export const WEBVIEW_HOST_CAPABILITY_VERSION = 1;

// Capabilities a webview must declare in its manifest before the bridge will route them.
export const WEBVIEW_DECLARABLE_CAPABILITIES = [
  "clipboard.write",
  "commands.execute",
  "commands.stream",
  "editing.session",
  "harnesses.read",
  "resources.actions",
  "navigation.open",
  "page.params.update",
  "placement.close",
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
  "account.read",
  "account.manage",
  "performance.read",
  "performance.control",
] as const;

// Capabilities that must be declared with a scope suffix (`name:scope`). Each
// declaration grants one scope; a bare declaration is invalid.
export const WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES = ["artifacts.read"] as const;

// Runtime plumbing the guest invokes on its own (e.g. keyboard forwarding). Enabled
// wherever the host implements them, with no manifest declaration required.
export const ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES = ["host.dispatchKeyboardEvent"] as const;

export const WEBVIEW_HOST_CAPABILITIES = [
  ...WEBVIEW_DECLARABLE_CAPABILITIES.filter((capability) => capability !== "clipboard.write"),
  ...WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES,
] as const;

export type WebviewHostCapability = (typeof WEBVIEW_HOST_CAPABILITIES)[number];
export type WebviewDeclarableCapability = (typeof WEBVIEW_DECLARABLE_CAPABILITIES)[number];
export type WebviewScopedDeclarableCapability = (typeof WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES)[number];
/** @deprecated Use bare capability names. Versions will be removed in 0.45. */
export type VersionedWebviewCapabilityDeclaration =
  `${WebviewDeclarableCapability}@${typeof WEBVIEW_HOST_CAPABILITY_VERSION}`;

export type WebviewCapabilityDeclaration =
  | WebviewDeclarableCapability
  | VersionedWebviewCapabilityDeclaration
  | `${WebviewScopedDeclarableCapability}:${string}`;

export interface WebviewCommandsExecuteParams {
  commandId: string;
  params?: JsonObject;
  workspaceId?: string;
  resource?: ResourceRef;
  metadata?: JsonObject;
}

export type WebviewCommandsStreamParams =
  | ({ operation: "start"; streamId: string } & WebviewCommandsExecuteParams)
  | { operation: "cancel"; streamId: string }
  | { operation: "ack"; streamId: string; bytes: number };

export type WebviewCommandStreamEvent =
  | { streamId: string; type: "data"; data: JsonValue }
  | { streamId: string; type: "end"; outcome: CommandOutcome };

export interface WebviewNavigationOpenParams {
  target: NavigationTarget;
}

/** @deprecated Use CommandNotice with type and message. */
export interface WebviewNotificationShowParams {
  level: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
}

/** @deprecated Invoke a command using ctx.notify.setStatus or setStatusByKey. */
export type WebviewNotificationActionParams = Omit<CreateNotificationInput, "projectId">;
/** @deprecated Invoke a command using ctx.notify.setStatus or setStatusByKey. */
export interface WebviewNotificationResolveParams {
  id?: string;
  dedupeKey?: string;
  status?: Extract<NotificationStatus, "done" | "dismissed" | "expired">;
}
/** @deprecated Invoke a command using ctx.notify.setStatus or setStatusByKey. */
export type WebviewNotificationDismissParams = Pick<WebviewNotificationResolveParams, "id" | "dedupeKey">;

export interface WebviewPreferencesGetParams {
  /** Access to another extension's registered names is deprecated. Use names owned by the caller. */
  name: string;
  scope?: {
    scope: "default" | "user" | "project" | "workspace" | "extension" | "session";
    scopeId?: string;
  };
}

export interface WebviewPreferencesSetParams extends WebviewPreferencesGetParams {
  value: boolean | number | string | string[] | number[] | boolean[] | Record<string, unknown>;
}

export interface WebviewPageParamsUpdateParams {
  /** Merge overrides into the active page. Null resets a name to its declared default. */
  params: Readonly<Record<string, PageParamValue | null>>;
}

export interface WebviewExtensionSettingKeyParams {
  key: string;
}

export interface WebviewExtensionSettingSetParams extends WebviewExtensionSettingKeyParams {
  value: unknown;
}

export type WebviewFileScope = { type: "project" } | { type: "resource"; id: string } | { type: string; id?: string };

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

// One bridge method covers every artifact read; the operation is in the params,
// mirroring terminal.session. The mount is always the mount's local id.
export type WebviewArtifactsReadParams =
  | { op: "list"; mount: string; prefix?: string }
  | { op: "readText"; mount: string; path: string }
  | { op: "imageUrl"; mount: string; path: string };

export interface WebviewArtifactFile {
  path: string;
  size: number;
  mediaType: string;
}

/** Reads mirror `ctx.account`. A missing project id means the webview's project. */
export type WebviewAccountReadParams =
  | { op: "status" }
  | { op: "loginStatus"; id: string }
  | { op: "devices" }
  | { op: "projectSyncStatus"; projectId?: string };

/** Changes mirror `ctx.account`. A missing project id means the webview's project. */
export type WebviewAccountManageParams =
  | { op: "login"; managerOrigin?: string }
  | { op: "cancelLogin"; id: string }
  | { op: "logout" }
  | { op: "renameDevice"; id: string; name: string }
  | { op: "removeDevice"; id: string }
  | { op: "syncProject"; projectId?: string }
  | { op: "stopProjectSync"; projectId?: string };

export type WebviewAccountResult<Params extends { op: keyof ExtensionAccountApi }> = Awaited<
  ReturnType<ExtensionAccountApi[Params["op"]]>
>;

export interface WebviewKeyboardEventParams {
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
}

/** A host-owned chord. Guests receive resolved keys, without parsing platform syntax. */
export interface WebviewKeyboardShortcut {
  id: string;
  /** Only these host navigation intents may be relayed by untrusted nested content. */
  entry?: "mode" | "tab";
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export interface WebviewKeyboardShortcutRequest {
  id: string;
  repeat: boolean;
  nested?: boolean;
}

export interface WebviewHostCapabilityParams {
  "performance.read": PerformanceReadRequest;
  "performance.control": PerformanceControlRequest;
  "harnesses.read": { harnessId?: string; model?: string };
  "resources.actions":
    | { operation: "list"; resource: ResourceRef }
    | { operation: "execute"; resource: ResourceRef; key: string };
  "commands.execute": WebviewCommandsExecuteParams;
  "commands.stream": WebviewCommandsStreamParams;
  "editing.session": WebviewEditingSessionParams;
  "page.params.update": WebviewPageParamsUpdateParams;
  "navigation.open": WebviewNavigationOpenParams;
  "placement.close": Record<string, never>;
  "notification.show": CommandNotice | WebviewNotificationShowParams;
  /** @deprecated Invoke a command using ctx.notify.setStatus or setStatusByKey. */
  "notification.action": WebviewNotificationActionParams;
  /** @deprecated Invoke a command using ctx.notify.setStatus or setStatusByKey. */
  "notification.resolve": WebviewNotificationResolveParams;
  /** @deprecated Invoke a command using ctx.notify.setStatus or setStatusByKey. */
  "notification.dismiss": WebviewNotificationDismissParams;
  "preferences.get": WebviewPreferencesGetParams;
  "preferences.set": WebviewPreferencesSetParams;
  "extension.settings.all": Record<string, never>;
  "extension.settings.get": WebviewExtensionSettingKeyParams;
  "extension.settings.set": WebviewExtensionSettingSetParams;
  "extension.settings.delete": WebviewExtensionSettingKeyParams;
  /** @deprecated Use the host terminal surface. */
  "terminal.session": TerminalSessionOperation;
  "files.upload": WebviewFilesUploadParams;
  /** @deprecated Use extension commands and owned storage. */
  "files.list": WebviewFilesListParams;
  /** @deprecated Use extension commands and owned storage. */
  "files.delete": WebviewFilesDeleteParams;
  "artifacts.read": WebviewArtifactsReadParams;
  "account.read": WebviewAccountReadParams;
  "account.manage": WebviewAccountManageParams;
  "host.dispatchKeyboardEvent": WebviewKeyboardEventParams;
}

export interface WebviewHostCapabilityResults {
  "performance.read": PerformanceReadResult;
  "performance.control": void;
  "harnesses.read": {
    harnesses: AgentInfo[];
    models: AgentModel[];
    schema?: HarnessParamsInfo;
    defaults?: Record<string, string | boolean>;
    selection?: ExtensionHarnessInput;
  };
  "resources.actions": WebviewResourceAction[];
  "commands.execute": { outcome: CommandOutcome };
  "commands.stream": { operation: "start" | "cancel" | "ack"; accepted: true };
  "editing.session": WebviewEditingSnapshot | undefined;
  "page.params.update": { location: PageLocation };
  "navigation.open": void;
  "placement.close": void;
  "notification.show": void;
  /** @deprecated Invoke a command using ctx.notify.setStatus or setStatusByKey. */
  "notification.action": Notification;
  /** @deprecated Invoke a command using ctx.notify.setStatus or setStatusByKey. */
  "notification.resolve": Notification | { resolved: number; notifications: Notification[] };
  /** @deprecated Invoke a command using ctx.notify.setStatus or setStatusByKey. */
  "notification.dismiss": Notification | { resolved: number; notifications: Notification[] };
  "preferences.get": WebviewPreferencesSetParams["value"] | undefined;
  "preferences.set": { name: string; value: WebviewPreferencesSetParams["value"] };
  "extension.settings.all": Record<string, unknown>;
  "extension.settings.get": unknown;
  "extension.settings.set": { key: string; value: unknown };
  "extension.settings.delete": void;
  /** @deprecated Use the host terminal surface. */
  "terminal.session": TerminalSessionResult;
  "files.upload": ExtensionBlobRef;
  /** @deprecated Use extension commands and owned storage. */
  "files.list": { files: ExtensionBlobRef[] };
  /** @deprecated Use extension commands and owned storage. */
  "files.delete": void;
  "artifacts.read": WebviewArtifactFile[] | string;
  "account.read": WebviewAccountResult<WebviewAccountReadParams>;
  "account.manage": WebviewAccountResult<WebviewAccountManageParams>;
  "host.dispatchKeyboardEvent": void;
}

export interface WebviewResourceAction {
  key: string;
  label: string;
  commandId?: string;
  /** Workbench icon name. */
  icon?: string;
  /** Image URL that replaces `icon` when present. */
  iconSrc?: string;
  /** Help text, or the reason the action is disabled. */
  description?: string;
  isDisabled?: boolean;
  separatorBefore?: boolean;
  group?: { id: string; label?: string };
}

export type WebviewHostCapabilityResult<
  Capability extends WebviewHostCapability,
  Params extends WebviewHostCapabilityParams[Capability] = WebviewHostCapabilityParams[Capability],
> = Capability extends "account.read" | "account.manage"
  ? Params extends { op: keyof ExtensionAccountApi }
    ? WebviewAccountResult<Params>
    : WebviewHostCapabilityResults[Capability]
  : Capability extends "artifacts.read"
    ? Params extends { op: "list" }
      ? WebviewArtifactFile[]
      : Params extends { op: "readText" | "imageUrl" }
        ? string
        : WebviewHostCapabilityResults[Capability]
    : Capability extends "terminal.session"
      ? Params extends { operation: "open" }
        ? Extract<TerminalSessionResult, { operation: "open" }>
        : Params extends { operation: "write" | "resize" | "kill" | "subscribe" }
          ? Exclude<TerminalSessionResult, { operation: "open" }>
          : TerminalSessionResult
      : WebviewHostCapabilityResults[Capability];
