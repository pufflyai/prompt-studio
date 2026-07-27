/**
 * Contracts shared between the extension host runtime and extensions.
 *
 * This module is the canonical home for the extension kernel: context/host API
 * types, command/event refs, kernel slots and events, localization markers,
 * workbench targets, and package asset descriptors. @pstdio/sdk re-exports this
 * surface for extension authors; host packages (pstdio-api, pstdio-extensions)
 * consume it directly.
 */
export type {
  CommitPayload,
  ConflictPayload,
  MergePayload,
  RebasePayload,
  SessionLifecyclePayload,
  WorkspaceProvisionPayload,
  WorkspaceType,
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
export { commandRef, eventRef } from "./refs";
export { defineSlot } from "./slots";
export type * from "./types";
export { EXTENSION_API_VERSION } from "./types/extension";
export {
  ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES,
  WEBVIEW_DECLARABLE_CAPABILITIES,
  WEBVIEW_HOST_CAPABILITIES,
  WEBVIEW_HOST_CAPABILITY_VERSION,
} from "./types/webview-capabilities";
export {
  getWorkbenchModeLayoutTargetPanel,
  getWorkbenchTargetDefinition,
  normalizeWorkbenchModePanels,
  type WorkbenchAttachmentTarget,
  type WorkbenchContributionKind,
  type WorkbenchLayoutTarget,
  type WorkbenchMenuTarget,
  type WorkbenchModeLayoutTarget,
  type WorkbenchModePanel,
  type WorkbenchRegion,
  type WorkbenchSettingsScope,
  type WorkbenchSettingsTarget,
  type WorkbenchTargetDefinition,
  type WorkbenchTargetGranularity,
  type WorkbenchTreeTarget,
  type WorkbenchViewTarget,
  workbenchMenuTargets,
  workbenchModeLayoutTargets,
  workbenchModePanels,
  workbenchRegions,
  workbenchSettingsScopes,
  workbenchSettingsTargets,
  workbenchTargets,
  workbenchTreeTargets,
  workbenchViewTargets,
} from "./workbench-targets";
