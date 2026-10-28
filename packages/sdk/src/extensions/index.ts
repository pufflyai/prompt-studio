export type {
  HistoryProjection,
  HistoryRecoveryInput,
  HistoryRecoveryResult,
} from "pstdio-api-contracts";
export {
  HistoryConflict,
  historyMessageKey,
  historyValueKey,
  mergeHistoryMetadata,
  reconcileMessageHistory,
  splitHistoryTurns,
  submittedPrompt,
} from "pstdio-api-contracts/collections";
export type * from "pstdio-api-contracts/extension-kernel";
export type {
  CommitPayload,
  ConflictPayload,
  MergePayload,
  RebasePayload,
  SessionLifecyclePayload,
  WorkspaceProvisionPayload,
  WorkspaceType,
  WorktreeRemovedPayload,
} from "pstdio-api-contracts/extension-kernel";
export {
  accountEvents,
  applyEditingChanges,
  DEFAULT_DATA_TABLE_SETTINGS,
  defineSlot,
  diffEditingState,
  dockedWorkbenchRegions,
  EXTENSION_API_VERSION,
  extensionPanelRegions,
  gitEvents,
  isFileSourcePosition,
  isLocalizedString,
  isNavigationTarget,
  isStorageLimitError,
  isValidLocalContributionId,
  type Localizable,
  type LocalizedString,
  l10n,
  localContributionIdGrammar,
  localContributionIdPattern,
  normalizeBooleanViewRule,
  packageAsset,
  pagePlaceholderView,
  projectEvents,
  projectSlots,
  rebaseEditingChanges,
  resourceEvents,
  sessionEvents,
  sessionSlots,
  storageLimits,
  VIEW_FILTER_CONDITIONS,
  viewDataEvents,
  workbenchModeDefinitions,
  workbenchModes,
  workbenchPageDefinitions,
  workbenchPages,
  workbenchPanelDefinitions,
  workbenchPanels,
  workbenchResourceKindDefinitions,
  workbenchResourceKinds,
  workbenchSlots,
  workspaceEvents,
  workspaceSlots,
  worktreeEvents,
} from "pstdio-api-contracts/extension-kernel";
export { SDK_VERSION } from "../version";
export { CommandOutcomeError, type CommandResponse, getCommandValue, unwrapCommandOutcome } from "./command-outcome";
export { commandRefId, contributionRefId } from "./contribution-reference";
export { defineCommand, defineHook, defineMiddleware, streamOf } from "./define-command";
export {
  defineActivityItem,
  defineArtifactMount,
  defineCommandPaletteResource,
  defineConnection,
  defineFileIconTheme,
  defineHarness,
  defineKeybinding,
  defineMode,
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  definePlacement,
  defineResourceHierarchyProvider,
  defineResourceKind,
  defineSchedule,
  defineSettingsPanel,
  defineSettingsSection,
  defineSkill,
  defineStatusBarItem,
  defineTemplate,
  defineTemplateType,
  defineTheme,
  defineView,
  defineViewMenu,
  defineWorkspaceType,
  resourceMenuSlotRef,
} from "./define-contribution";
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
export { resolveEventReferenceId } from "./event-reference";
export { chooseHarnessAuthentication } from "./harness-authentication";
export {
  installWebviewKeyboardRelay,
  type WebviewKeyboardRelayHost,
  webviewKeyboardRelayDocument,
} from "./keyboard-relay";
export { defaultPageResourceCodec } from "./page-resource-codec";
export {
  isWorkbenchProjectUrl,
  type PageUrlDefinition,
  type ParsedWorkbenchPageUrl,
  parsePageUrl,
  parseWorkbenchPageUrl,
  serializePageUrl,
  serializeWorkbenchPageUrl,
} from "./page-url";
export { params } from "./params";
export { type QualifiedRef, qualifyRef } from "./qualify-ref";
export { artifactChanged, commandEvent, commandRef, eventRef } from "./refs";
export { resourceKey } from "./resource-key";
export {
  createTerminalSessionBridge,
  type TerminalSessionAdapter,
  type TerminalSessionBridge,
  type TerminalSessionExit,
} from "./terminal-session-bridge";
export type { WebviewAccountClient } from "./webview-account-client";
export { type ArtifactMountKey, artifactMountId, artifactsRead } from "./webview-capabilities";
export {
  createWebviewClient,
  type WebviewArtifactsClient,
  type WebviewClient,
  type WebviewClientOptions,
  type WebviewCommandsClient,
  type WebviewSettingsClient,
} from "./webview-client";
export type {
  EditingSessionOptions,
  EditingSnapshot,
  WebviewEditingClient,
  WebviewEditingSession,
} from "./webview-editing";
export { EXTENSION_EVENTS_SCOPE, type WebviewEventsClient, type WebviewExtensionEvent } from "./webview-events";
export { matchesResourceWhen } from "./when";
export const projectPrefix = () => ({ $prefix: "project" as const });

export type { WebviewHostProps } from "pstdio-api-contracts/extension-kernel";
export type {
  PerformanceCapture,
  PerformanceCaptureSample,
  PerformanceMonitoringState,
  PerformanceProcessSample,
  PerformanceRecordingExport,
  PerformanceResponseSample,
  PerformanceRuntimeReading,
  PerformanceSnapshot,
} from "pstdio-api-contracts/performance-diagnostics";
export { prepareHarnessPackage } from "./harness-package";
export {
  ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES,
  mergeOrderedHistory,
  normalizePageParams,
  qualifyNavigationTarget,
  resolveDataTableComparableValue,
  resolveDataTableFieldKind,
  resolvePageParams,
  validatePageParamDefinitions,
  WEBVIEW_DECLARABLE_CAPABILITIES,
  WEBVIEW_HOST_CAPABILITIES,
  WEBVIEW_HOST_CAPABILITY_VERSION,
  WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES,
} from "./host-compat";
export type {
  AssetReference,
  AssetTransfer,
  CreateNotificationInput,
  ListNotificationsQuery,
  ListNotificationsResponse,
  Notification,
  NotificationAction,
  NotificationActorType,
  NotificationKind,
  NotificationOrigin,
  NotificationPriority,
  NotificationStatus,
  UpdateNotificationInput,
} from "./resource-compat";
export { isWebviewCapabilityError, type WebviewCapabilityError } from "./webview-capability-error";
export type { WebviewPageClient } from "./webview-page-client";
export type { WebviewPerformanceClient } from "./webview-performance-client";
export type { CommandStream, CommandStreamOptions, WebviewStreamsClient } from "./webview-streams";
