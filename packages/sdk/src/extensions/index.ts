export { type CommandResponse, unwrapCommandOutcome } from "./command-outcome";
export { defineCommand, defineHook, defineMiddleware } from "./define-command";
export { defineExtension } from "./define-extension";
export {
  defineExtensionView,
  type ExtensionViewModule,
  type ExtensionViewRender,
  type ExtensionViewRenderContext,
  type GuestHost,
  type PropsStore,
  type WebviewFilesClient,
} from "./define-extension-view";
export type {
  CommitPayload,
  ConflictPayload,
  MergePayload,
  RebasePayload,
  SessionLifecyclePayload,
  WorktreeCreatedEventPayload,
  WorktreeRemovedPayload,
} from "./kernel-slots";
export {
  gitEvents,
  projectEvents,
  projectSlots,
  sessionEvents,
  sessionSlots,
  workspaceEvents,
  workspaceSlots,
  worktreeEvents,
} from "./kernel-slots";
export { isLocalizedString, type Localizable, type LocalizedString, l10n } from "./l10n";
export { packageAsset } from "./package-asset";
export { params } from "./params";
export { commandEvent, commandRef, commandsOf, eventRef } from "./refs";
export type * from "./types";
export { EXTENSION_API_VERSION } from "./types/extension";
export {
  ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES,
  WEBVIEW_DECLARABLE_CAPABILITIES,
  WEBVIEW_HOST_CAPABILITIES,
  WEBVIEW_HOST_CAPABILITY_VERSION,
} from "./types/webview-capabilities";
export { matchesResourceWhen } from "./when";
export {
  getWorkbenchTargetDefinition,
  type WorkbenchAttachmentTarget,
  type WorkbenchContributionKind,
  type WorkbenchLayoutTarget,
  type WorkbenchMenuTarget,
  type WorkbenchModeLayoutTarget,
  type WorkbenchSettingsScope,
  type WorkbenchSettingsTarget,
  type WorkbenchTargetDefinition,
  type WorkbenchTargetGranularity,
  type WorkbenchTreeTarget,
  type WorkbenchViewTarget,
  workbenchMenuTargets,
  workbenchModeLayoutTargets,
  workbenchSettingsScopes,
  workbenchSettingsTargets,
  workbenchTargets,
  workbenchTreeTargets,
  workbenchViewTargets,
} from "./workbench-targets";
