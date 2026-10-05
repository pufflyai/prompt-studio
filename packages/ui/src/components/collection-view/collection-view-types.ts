import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";

export type {
  ViewFilterCondition,
  ViewFilterGroup,
  ViewFilterRule,
  ViewSort,
  ViewSortDirection,
} from "@pstdio/sdk/extensions";

export const EMPTY_VIEW_FILTER: ViewFilterGroup = { conjunction: "and", rules: [] };

/** What a saved view stores. Search, selection, and collapsed groups are screen state and never saved. */
export interface CollectionSavedView<TSettings> {
  id: string;
  title: string;
  settings: TSettings;
  filter: ViewFilterGroup;
  sorts: ViewSort[];
  /** @deprecated Use defaultActiveViewId instead. */
  isDefault?: boolean;
}

export interface CollectionViewState<TSettings> {
  settings: TSettings;
  filter: ViewFilterGroup;
  sorts: ViewSort[];
}

export interface CollectionViewsSource<TSettings> {
  views: (CollectionSavedView<TSettings> & { builtIn: boolean })[];
  defaultViewId: string;
  onCreateView: (
    input: CollectionViewState<TSettings> & { title: string; copyFrom?: string },
  ) => Promise<CollectionSavedView<TSettings>>;
  onUpdateView: (id: string, input: Partial<CollectionViewState<TSettings>> & { title?: string }) => Promise<void>;
  onDeleteView: (id: string) => Promise<void>;
  onSetDefaultView: (id: string | null) => Promise<void>;
}
