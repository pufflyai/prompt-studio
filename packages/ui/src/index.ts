export { ChakraProvider } from "@chakra-ui/react";
// Feature modules (light, reused). Heavy features live behind their own subpaths.
export type {
  ActivityActor,
  ActivityAvatarProps,
  ActivityCommentProps,
  ActivityComposerProps,
  ActivityEventProps,
  ActivityFeedProps,
  ActivityHeaderProps,
  ActivityReplyProps,
  ActivityRootProps,
  ActivityTimelineProps,
} from "@/components/activity";
export {
  Activity,
  ActivityAvatar,
  ActivityComment,
  ActivityComposer,
  ActivityEvent,
  ActivityFeed,
  ActivityHeader,
  ActivityReply,
  ActivityRoot,
  ActivityTimeline,
} from "@/components/activity";
// Curated design-system groups (see components/<group>/index.ts).
export * from "@/components/command-palette";
export * from "@/components/layout";
export { ListRow } from "@/components/list-row/list-row";
export type {
  ListRowAction,
  ListRowActionContext,
  ListRowActionMenuItem,
  ListRowItem,
  ListRowNavigationIntent,
} from "@/components/list-row/list-row.types";
export type {
  NotificationCenterAction,
  NotificationCenterItem,
  NotificationCenterPriority,
  NotificationCenterProps,
  NotificationCenterStatus,
} from "@/components/notification-center";
export { NotificationCenter } from "@/components/notification-center";
export * from "@/components/overlays";
export * from "@/components/param-editor";
export * from "@/components/primitives";
export { Sidenav } from "@/components/sidenav/sidenav";
export { useSidenavStore } from "@/components/sidenav/sidenav.store";
export type { SidenavProps } from "@/components/sidenav/sidenav.types";
export { getTabVisibilityStore, useTabVisibilityStore } from "@/components/tab-strip/tab-visibility.store";
export type { TabVisibilityPlacement } from "@/components/tab-strip/tab-visibility-filter";
export { buildTabVisibilityMenuActions, filterVisibleTabs } from "@/components/tab-strip/tab-visibility-filter";
export type {
  SaveTagSettingsInput,
  TagEditorAction,
  TagEditorHeadingProps,
  TagEditorProps,
  TagEditorSaveBarProps,
  TagEditorValue,
  TagSettingsPanelProps,
} from "@/components/tag-editor";
export { TagEditor, TagEditorHeading, TagEditorSaveBar, TagSettingsPanel } from "@/components/tag-editor";
export { TreeList } from "@/components/tree-list/tree-list";
export type {
  TreeListAction,
  TreeListActionContext,
  TreeListActionMenuItem,
  TreeListLinkComponent,
  TreeListNavigateEvent,
  TreeListNavigationIntent,
  TreeListNode,
  TreeListSection,
} from "@/components/tree-list/tree-list.types";
export { getTreeListOrderStore, useTreeListOrderStore } from "@/components/tree-list/tree-list-order.store";
export { applyTreeListOrder } from "@/components/tree-list/tree-list-order-filter";
export type { VisibilityOverride } from "@/components/tree-list/tree-list-visibility.store";
export {
  getTreeListVisibilityStore,
  useTreeListVisibilityStore,
} from "@/components/tree-list/tree-list-visibility.store";
export type { TreeVisibilityMenuItems } from "@/components/tree-list/tree-list-visibility-filter";
export {
  buildTreeVisibilityMenuActions,
  filterVisibleNodes,
  filterVisibleSections,
  resolveVisibility,
} from "@/components/tree-list/tree-list-visibility-filter";

// Theme + utils.
export type { MonacoThemeData, VsCodeColorTheme } from "@/theme";
export { createMonacoThemeFromVsCodeTheme, createThemePreferenceFromVsCodeTheme, psTheme } from "@/theme";
export {
  applyFileIconThemePreference,
  defaultFileIconThemePreferences,
  type FileIconThemeFont,
  type FileIconThemePreferenceOption,
  isFileIconThemePreference,
  resolveFileIconGlyph,
} from "@/utils/apply-file-icon-theme-preference";
export {
  applyThemePreference,
  defaultThemePreferences,
  getThemePreferenceClassName,
  getThemePreferenceClassNames,
  getThemePreferenceMode,
  isThemePreference,
  type ThemePreference,
  type ThemePreferenceMode,
  type ThemePreferenceOption,
  type ThemePreferenceTokens,
} from "@/utils/apply-theme-preference";
export { FileIconThemePreferenceProvider, useFileIconThemePreference } from "@/utils/file-icon-theme-preference";
export { getFileTypeIcon } from "@/utils/get-file-type-icon";
export { installPrismGlobal } from "@/utils/prism";
export { resolveFileIconElement } from "@/utils/resolve-file-icon-element";
export { getInitialThemePreference, ThemePreferenceProvider, useThemePreference } from "@/utils/theme-preference";
