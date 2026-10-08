/**
 * Contracts shared between the extension host runtime and extensions.
 *
 * This module is the canonical home for the extension kernel: context/host API
 * types, command/event refs, kernel slots and events, localization markers,
 * workbench targets, and package asset descriptors. @pstdio/sdk re-exports this
 * surface for extension authors; host packages (pstdio-api, pstdio-extensions)
 * consume it directly.
 */

export { parseExtensionApiDeclaration, supportsExtensionApiVersion } from "./api-versions";
export { normalizeBooleanViewRule } from "./boolean-view-filter";
export {
  workbenchModeDefinitions,
  workbenchModes,
  workbenchPageDefinitions,
  workbenchPages,
  workbenchPanelDefinitions,
  workbenchPanels,
  workbenchResourceKindDefinitions,
  workbenchResourceKinds,
  workbenchSlots,
} from "./builtin-refs";
export {
  isValidLocalContributionId,
  localContributionIdGrammar,
  localContributionIdPattern,
} from "./contribution-id";
export { resolveDataTableComparableValue, resolveDataTableFieldKind } from "./data-table-values";
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
  viewDataEvents,
  workspaceEvents,
  workspaceSlots,
  worktreeEvents,
} from "./kernel-slots";
export { isLocalizedString, type Localizable, type LocalizedString, l10n } from "./l10n";
export { isNavigationTarget, qualifyNavigationTarget } from "./navigation";
export { packageAsset } from "./package-asset";
export { commandRef, eventRef } from "./refs";
export { defineSlot } from "./slots";
export { isFileSourcePosition } from "./source-position";
export type * from "./types";
export { VIEW_FILTER_CONDITIONS } from "./types/collection-view";
export { dockedWorkbenchRegions, extensionPanelRegions } from "./types/composition";
export { DEFAULT_DATA_TABLE_SETTINGS } from "./types/data-table-renderer";
export { EXTENSION_API_VERSION } from "./types/extension";
export {
  ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES,
  WEBVIEW_DECLARABLE_CAPABILITIES,
  WEBVIEW_HOST_CAPABILITIES,
  WEBVIEW_HOST_CAPABILITY_VERSION,
  WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES,
} from "./types/webview-capabilities";
