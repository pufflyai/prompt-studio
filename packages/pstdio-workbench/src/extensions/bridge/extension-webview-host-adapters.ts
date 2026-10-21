import type { CommandExecutionResult } from "@pstdio/sdk/api";
import type { CommandStreamClientEvent } from "@pstdio/sdk/client";
import type {
  CommandNotice,
  ExtensionAccountApi,
  MaybePromise,
  NavigationTarget,
  PageLocation,
  WebviewArtifactsReadParams,
  WebviewCommandsExecuteParams,
  WebviewExtensionSettingSetParams,
  WebviewFilesDeleteParams,
  WebviewFilesListParams,
  WebviewFilesUploadParams,
  WebviewHostCapabilityParams,
  WebviewHostCapabilityResults,
  WebviewNotificationActionParams,
  WebviewNotificationResolveParams,
  WebviewPageParamsUpdateParams,
  WebviewPreferencesGetParams,
  WebviewPreferencesSetParams,
} from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchTerminalController } from "../../core";

export interface ExtensionWebviewSettingsAdapter {
  all(): MaybePromise<Record<string, unknown>>;
  get(key: string): MaybePromise<unknown>;
  set(key: string, value: WebviewExtensionSettingSetParams["value"]): MaybePromise<{ value: unknown }>;
  delete(key: string): MaybePromise<void>;
}

export interface ExtensionWebviewNotificationsAdapter {
  show?(notice: CommandNotice): MaybePromise<unknown>;
  create?(input: WebviewNotificationActionParams): MaybePromise<WebviewHostCapabilityResults["notification.action"]>;
  resolve?(input: WebviewNotificationResolveParams): MaybePromise<WebviewHostCapabilityResults["notification.resolve"]>;
}

export interface ExtensionWebviewPreferencesAdapter {
  get(
    name: string,
    scope?: WebviewPreferencesGetParams["scope"],
  ): MaybePromise<WebviewHostCapabilityResults["preferences.get"]>;
  set(
    name: string,
    value: WebviewPreferencesSetParams["value"],
    scope: NonNullable<WebviewPreferencesSetParams["scope"]>,
  ): MaybePromise<void>;
}

export interface ExtensionWebviewFilesAdapter {
  upload(input: WebviewFilesUploadParams): MaybePromise<WebviewHostCapabilityResults["files.upload"]>;
  list(input: WebviewFilesListParams): MaybePromise<WebviewHostCapabilityResults["files.list"]>;
  delete(input: WebviewFilesDeleteParams): MaybePromise<void>;
}

export interface ExtensionWebviewHostAdapters {
  harnesses?: {
    read(input: { harnessId?: string; model?: string }): MaybePromise<WebviewHostCapabilityResults["harnesses.read"]>;
  };
  resourceActions?: (
    input: WebviewHostCapabilityParams["resources.actions"],
  ) => MaybePromise<WebviewHostCapabilityResults["resources.actions"]>;
  executeCommand?(input: WebviewCommandsExecuteParams, signal?: AbortSignal): MaybePromise<unknown>;
  streamCommand?(input: WebviewCommandsExecuteParams, signal: AbortSignal): AsyncIterable<CommandStreamClientEvent>;
  commandCompleted?(response: CommandExecutionResult): void;
  hostEvents?: HostEventPublisher;
  navigation?: { open(target: NavigationTarget): MaybePromise<unknown> };
  pageParams?: { update(params: WebviewPageParamsUpdateParams["params"]): MaybePromise<PageLocation> };
  placement?: { close(): MaybePromise<void> };
  notifications?: ExtensionWebviewNotificationsAdapter;
  settings?: ExtensionWebviewSettingsAdapter;
  preferences?: ExtensionWebviewPreferencesAdapter;
  files?: ExtensionWebviewFilesAdapter;
  artifacts?: { read(input: WebviewArtifactsReadParams): MaybePromise<WebviewHostCapabilityResults["artifacts.read"]> };
  /** The host's Cloud account. Methods without a project id use the webview's project. */
  account?: ExtensionAccountApi;
  terminal?: WorkbenchTerminalController;
}
