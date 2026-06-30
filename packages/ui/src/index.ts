export { ChakraProvider } from "@chakra-ui/react";
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
export type {
  FilterPaletteEntriesOptions,
  PaletteEntry,
  PaletteEscapeContext,
  PaletteMode,
  PaletteProps,
  PaletteSearchEntry,
  PaletteState,
  PaletteStateValue,
} from "@/components/command-palette/palette";
export {
  DEFAULT_PALETTE_ASSET_LIMIT,
  filterPaletteEntries,
  Palette,
} from "@/components/command-palette/palette";
export type { PaletteShortcutBinding } from "@/components/command-palette/palette-shortcut";
export { PaletteShortcut } from "@/components/command-palette/palette-shortcut";
export type {
  OpenSourceNotice,
  OpenSourceNoticesScreenProps,
} from "@/components/internal/open-source-notices-screen";
export { OpenSourceNoticesScreen } from "@/components/internal/open-source-notices-screen";
export type { HeaderProps, HeaderVariant } from "@/components/layout/header";
export { Header } from "@/components/layout/header";
export { HorizontalMenuStack } from "@/components/layout/horizontal-menu-stack";
export type { ItemSectionProps } from "@/components/layout/item-section";
export { ItemSection } from "@/components/layout/item-section";
export { ResizableSplitLayout } from "@/components/layout/resizable-split-layout";
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
export { AttachedPanel } from "@/components/overlays/attached-panel";
export { BubbleButton } from "@/components/overlays/bubble-button";
export { BubblePanel } from "@/components/overlays/bubble-panel";
export { DeleteConfirmationModal } from "@/components/overlays/delete-confirmation-modal";
export type { RepoPickerDialogEntry, RepoPickerDialogProps } from "@/components/overlays/repo-picker-dialog";
export { RepoPickerDialog } from "@/components/overlays/repo-picker-dialog";
export type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
export { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
export type { SearchModalContentProps } from "@/components/overlays/search-modal-content";
export { SearchModalContent } from "@/components/overlays/search-modal-content";
export type { SearchableMenuItem, SearchableMenuParentList } from "@/components/overlays/searchable-menu";
export { SearchableMenu } from "@/components/overlays/searchable-menu";
export type { ParamEditorProps } from "@/components/param-editor";
export { ParamEditor } from "@/components/param-editor";
export type { AlertProps } from "@/components/primitives/alert";
export { AlertMessage } from "@/components/primitives/alert";
export type { BreadcrumbItem } from "@/components/primitives/breadcrumb";
export { Breadcrumb } from "@/components/primitives/breadcrumb";
export type { CheckboxProps } from "@/components/primitives/checkbox";
export { Checkbox } from "@/components/primitives/checkbox";
export {
  ContentPlaceholder,
  Label as ContentPlaceholderLabel,
} from "@/components/primitives/content-placeholder";
export type { EmptyStateProps } from "@/components/primitives/empty-state";
export { EmptyState } from "@/components/primitives/empty-state";
export { ErrorBoundary } from "@/components/primitives/error-boundary";
export type { IconColorPickerIconOption, IconColorPickerProps } from "@/components/primitives/icon-color-picker";
export {
  getIconComponent,
  IconColorPicker,
  optionColors,
  optionIcons,
} from "@/components/primitives/icon-color-picker";
export type { IntegrationCardProps } from "@/components/primitives/integration-card";
export { IntegrationCard } from "@/components/primitives/integration-card";
export type { RadioProps } from "@/components/primitives/radio";
export { Radio, RadioGroup } from "@/components/primitives/radio";
export { ResourceBadge } from "@/components/primitives/resource-badge";
export { ScrollArea } from "@/components/primitives/scroll-area";
export type { SessionCompletionStatus } from "@/components/primitives/session-indicator";
export {
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  SessionIndicator,
} from "@/components/primitives/session-indicator";
export type { SimpleCardBodyProps, SimpleCardProps } from "@/components/primitives/simple-card";
export { SimpleCard, SimpleCardBody } from "@/components/primitives/simple-card";
export type { SwitchProps } from "@/components/primitives/switch";
export { Switch } from "@/components/primitives/switch";
export { Toaster, toaster } from "@/components/primitives/toaster";
export { Tooltip } from "@/components/primitives/tooltip";
export type { WorkspaceBadgeProps } from "@/components/primitives/workspace-badge";
export { WorkspaceBadge } from "@/components/primitives/workspace-badge";
export { Sidebar } from "@/components/sidebar/sidebar";
export { useSidebarStore } from "@/components/sidebar/sidebar.store";
export type { SidebarProps } from "@/components/sidebar/sidebar.types";
export {
  getTabVisibilityStore,
  useTabVisibilityStore,
} from "@/components/tab-strip/tab-visibility.store";
export type { TabVisibilityPlacement } from "@/components/tab-strip/tab-visibility-filter";
export {
  buildTabVisibilityMenuActions,
  filterVisibleTabs,
} from "@/components/tab-strip/tab-visibility-filter";
export type {
  SaveTagSettingsInput,
  TagEditorAction,
  TagEditorProps,
  TagEditorValue,
  TagSettingsPanelProps,
} from "@/components/tag-editor";
export { TagEditor, TagSettingsPanel } from "@/components/tag-editor";
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
export {
  getTreeListOrderStore,
  useTreeListOrderStore,
} from "@/components/tree-list/tree-list-order.store";
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
export type { MonacoThemeData, VsCodeColorTheme } from "@/theme";
export {
  createMonacoThemeFromVsCodeTheme,
  createThemePreferenceFromVsCodeTheme,
  psTheme,
} from "@/theme";
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
export {
  FileIconThemePreferenceProvider,
  useFileIconThemePreference,
} from "@/utils/file-icon-theme-preference";
export { getFileTypeIcon } from "@/utils/get-file-type-icon";
export { installPrismGlobal } from "@/utils/prism";
export { resolveFileIconElement } from "@/utils/resolve-file-icon-element";
export {
  getInitialThemePreference,
  ThemePreferenceProvider,
  useThemePreference,
} from "@/utils/theme-preference";
