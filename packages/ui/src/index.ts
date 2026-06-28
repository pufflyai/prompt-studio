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
} from "./components/activity";
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
} from "./components/activity";
export type { AlertProps } from "./components/alert";
export { AlertMessage } from "./components/alert";
export { AttachedPanel } from "./components/attached-panel";
export type { BreadcrumbItem } from "./components/breadcrumb";
export { Breadcrumb } from "./components/breadcrumb";
export { BubbleButton } from "./components/bubble-button";
export { BubblePanel } from "./components/bubble-panel";
export type { CheckboxProps } from "./components/checkbox";
export { Checkbox } from "./components/checkbox";
export { CodeDiffEditor, CodeEditor } from "./components/code-editor";
export {
  ContentPlaceholder,
  Label as ContentPlaceholderLabel,
} from "./components/content-placeholder";
export type { BoardColumnConfig, DataRendererProps } from "./components/data-renderer/data-renderer";
export { DataRenderer } from "./components/data-renderer/data-renderer";
export type {
  DataRendererBoardColumn,
  DataRendererBoardColumnAction,
  DataRendererBoardItem,
} from "./components/data-renderer/data-renderer-board";
export { DataRendererBoard } from "./components/data-renderer/data-renderer-board";
export type { DataRendererCardProps } from "./components/data-renderer/data-renderer-card";
export { DataRendererCard } from "./components/data-renderer/data-renderer-card";
export type { AttributeBadge, FilterCategoryView, MenuOption } from "./components/data-renderer/data-renderer-helpers";
export {
  buildDisplayPropertyOptions,
  buildFilterCategories,
  buildGroupingOptions,
  buildOrderingOptions,
  collectDisplayBadges,
  getAttributeStringValues,
  getAttributeValue,
  getEnumOptions,
  renderAttributeBadge,
  sanitizeFilters,
  sanitizeSettings,
} from "./components/data-renderer/data-renderer-helpers";
export type { DataRendererListItem } from "./components/data-renderer/data-renderer-list";
export { DataRendererList } from "./components/data-renderer/data-renderer-list";
export type { DataRendererToolbarProps } from "./components/data-renderer/data-renderer-toolbar";
export { DataRendererToolbar } from "./components/data-renderer/data-renderer-toolbar";
export { DisplayMenu } from "./components/data-renderer/display-menu";
export { FilterMenu } from "./components/data-renderer/filter-menu";
export type {
  AttributeDescriptor,
  AttributeDisplayDescriptor,
  AttributeKind,
  AttributesSource,
  AttributeType,
  DataRendererFilterState,
  DataRendererOrdering,
  DataRendererRow,
  DataRendererSettings,
  EnumOption,
  EnumOptions,
  EnumOptionsSource,
  SortDirection,
  ViewMode,
} from "./components/data-renderer/types";
export {
  findAttribute,
  isAttributesSource,
  isEnumOptionsSource,
  MANUAL_ORDERING,
  NO_GROUPING,
} from "./components/data-renderer/types";
export { useDataRendererStore } from "./components/data-renderer/use-data-renderer-store";
export { resolveAttributeOptions, useResolvedAttributes } from "./components/data-renderer/use-resolved-attributes";
export { DeleteConfirmationModal } from "./components/delete-confirmation-modal";
export type { ChangedFilesViewMode, Diff, DiffViewerProps, DiffViewMode, FileIconInfo } from "./components/diff-viewer";
export { DiffDrawer, DiffViewer, useDiffViewerStore } from "./components/diff-viewer";
export { DiffBubble } from "./components/diff-viewer/diff-bubble";
export type { EmptyStateProps } from "./components/empty-state";
export { EmptyState } from "./components/empty-state";
export { ErrorBoundary } from "./components/error-boundary";
export type { HeaderProps, HeaderVariant } from "./components/header";
export { Header } from "./components/header";
export { HorizontalMenuStack } from "./components/horizontal-menu-stack";
export type { IconColorPickerIconOption, IconColorPickerProps } from "./components/icon-color-picker";
export { getIconComponent, IconColorPicker, optionColors, optionIcons } from "./components/icon-color-picker";
export type { IntegrationCardProps } from "./components/integration-card";
export { IntegrationCard } from "./components/integration-card";
export type { ItemSectionProps } from "./components/item-section";
export { ItemSection } from "./components/item-section";
export { ListRow } from "./components/list-row/list-row";
export type {
  ListRowAction,
  ListRowActionContext,
  ListRowActionMenuItem,
  ListRowItem,
  ListRowNavigationIntent,
} from "./components/list-row/list-row.types";
export type { MermaidRendererProps } from "./components/mermaid-renderer";
export { MermaidRenderer } from "./components/mermaid-renderer";
export type {
  NotificationCenterAction,
  NotificationCenterItem,
  NotificationCenterPriority,
  NotificationCenterProps,
  NotificationCenterStatus,
} from "./components/notification-center";
export { NotificationCenter } from "./components/notification-center";
export type {
  OpenSourceNotice,
  OpenSourceNoticesScreenProps,
} from "./components/open-source-notices-screen";
export { OpenSourceNoticesScreen } from "./components/open-source-notices-screen";
export type {
  FilterPaletteEntriesOptions,
  PaletteEntry,
  PaletteEscapeContext,
  PaletteMode,
  PaletteProps,
  PaletteSearchEntry,
  PaletteState,
  PaletteStateValue,
} from "./components/palette";
export {
  DEFAULT_PALETTE_ASSET_LIMIT,
  filterPaletteEntries,
  Palette,
} from "./components/palette";
export type { PaletteShortcutBinding } from "./components/palette-shortcut";
export { PaletteShortcut } from "./components/palette-shortcut";
export type { ParamEditorProps } from "./components/param-editor";
export { ParamEditor } from "./components/param-editor";
export type { RadioProps } from "./components/radio";
export { Radio, RadioGroup } from "./components/radio";
export type { RepoPickerDialogEntry, RepoPickerDialogProps } from "./components/repo-picker-dialog";
export { RepoPickerDialog } from "./components/repo-picker-dialog";
export { ResizableSplitLayout } from "./components/resizable-split-layout";
export { ResourceBadge } from "./components/resource-badge";
export type { ResourceContextAction } from "./components/resource-context-menu";
export { ResourceContextMenu } from "./components/resource-context-menu";
export { ScrollArea } from "./components/scroll-area";
export type { SearchModalContentProps } from "./components/search-modal-content";
export { SearchModalContent } from "./components/search-modal-content";
export type { SearchableMenuItem, SearchableMenuParentList } from "./components/searchable-menu";
export { SearchableMenu } from "./components/searchable-menu";
export type { SessionCompletionStatus } from "./components/session-indicator";
export {
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  SessionIndicator,
} from "./components/session-indicator";
export { Sidebar } from "./components/sidebar/sidebar";
export { useSidebarStore } from "./components/sidebar/sidebar.store";
export type { SidebarProps } from "./components/sidebar/sidebar.types";
export type { SimpleCardBodyProps, SimpleCardProps } from "./components/simple-card";
export { SimpleCard, SimpleCardBody } from "./components/simple-card";
export type { SwitchProps } from "./components/switch";
export { Switch } from "./components/switch";
export {
  getTabVisibilityStore,
  useTabVisibilityStore,
} from "./components/tab-strip/tab-visibility.store";
export type { TabVisibilityPlacement } from "./components/tab-strip/tab-visibility-filter";
export {
  buildTabVisibilityMenuActions,
  filterVisibleTabs,
} from "./components/tab-strip/tab-visibility-filter";
export type {
  SaveTagSettingsInput,
  TagEditorAction,
  TagEditorProps,
  TagEditorValue,
  TagSettingsPanelProps,
} from "./components/tag-editor";
export { TagEditor, TagSettingsPanel } from "./components/tag-editor";
export { Toaster, toaster } from "./components/toaster";
export { Tooltip } from "./components/tooltip";
export { TreeList } from "./components/tree-list/tree-list";
export type {
  TreeListAction,
  TreeListActionContext,
  TreeListActionMenuItem,
  TreeListLinkComponent,
  TreeListNavigateEvent,
  TreeListNavigationIntent,
  TreeListNode,
  TreeListSection,
} from "./components/tree-list/tree-list.types";
export {
  getTreeListOrderStore,
  useTreeListOrderStore,
} from "./components/tree-list/tree-list-order.store";
export { applyTreeListOrder } from "./components/tree-list/tree-list-order-filter";
export type { VisibilityOverride } from "./components/tree-list/tree-list-visibility.store";
export {
  getTreeListVisibilityStore,
  useTreeListVisibilityStore,
} from "./components/tree-list/tree-list-visibility.store";
export type { TreeVisibilityMenuItems } from "./components/tree-list/tree-list-visibility-filter";
export {
  buildTreeVisibilityMenuActions,
  filterVisibleNodes,
  filterVisibleSections,
  resolveVisibility,
} from "./components/tree-list/tree-list-visibility-filter";
export type { WorkspaceBadgeProps } from "./components/workspace-badge";
export { WorkspaceBadge } from "./components/workspace-badge";
export type { MonacoThemeData, VsCodeColorTheme } from "./theme";
export {
  createMonacoThemeFromVsCodeTheme,
  createThemePreferenceFromVsCodeTheme,
  psTheme,
} from "./theme";
export {
  applyFileIconThemePreference,
  defaultFileIconThemePreferences,
  type FileIconThemeFont,
  type FileIconThemePreferenceOption,
  isFileIconThemePreference,
  resolveFileIconGlyph,
} from "./utils/apply-file-icon-theme-preference";
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
} from "./utils/apply-theme-preference";
export {
  FileIconThemePreferenceProvider,
  useFileIconThemePreference,
} from "./utils/file-icon-theme-preference";
export { getFileTypeIcon } from "./utils/get-file-type-icon";
export { installPrismGlobal } from "./utils/prism";
export { resolveFileIconElement } from "./utils/resolve-file-icon-element";
export {
  getInitialThemePreference,
  ThemePreferenceProvider,
  useThemePreference,
} from "./utils/theme-preference";
