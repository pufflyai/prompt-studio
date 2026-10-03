import { Box } from "@chakra-ui/react";
import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { DisplayMenu } from "../kanban-renderer/display-menu";
import { CollectionViewBar } from "./collection-view-bar";
import { storyFields, storyOptions } from "./collection-view-story-fixtures";
import { type CollectionSavedView, EMPTY_VIEW_FILTER } from "./collection-view-types";
import { DisplaySortControl } from "./display-sort-control";
import { useCollectionViewStore } from "./use-collection-view-store";
import { useCollectionViews } from "./use-collection-views";

interface StorySettings {
  displayProperties: string[];
  viewMode: "board" | "list";
  columnGrouping: string;
  rowGrouping: string;
}

const settings: StorySettings = {
  displayProperties: [],
  viewMode: "board",
  columnGrouping: "none",
  rowGrouping: "none",
};

interface BarProps {
  storageKey: string;
  filter?: ViewFilterGroup;
  sorts?: ViewSort[];
  /** Applied after the view loads, so the tab shows unsaved changes. */
  editedSorts?: ViewSort[];
}

export const Bar = (props: BarProps) => {
  const { storageKey, filter = EMPTY_VIEW_FILTER, sorts = [], editedSorts } = props;
  const [savedViews, setSavedViews] = useState<(CollectionSavedView<StorySettings> & { builtIn: boolean })[]>([
    { id: "all", title: "All tickets", settings, filter, sorts, builtIn: true },
    { id: "mine", title: "My work", settings, filter: EMPTY_VIEW_FILTER, sorts: [], builtIn: false },
  ]);
  const [search, setSearch] = useState("");
  const initialState = { settings };
  const viewsSource = {
    views: savedViews,
    defaultViewId: "all",
    onCreateView: async (input: Omit<CollectionSavedView<StorySettings>, "id">) => {
      const view = { ...input, id: crypto.randomUUID(), builtIn: false };
      setSavedViews((current) => [...current, view]);
      return view;
    },
    onUpdateView: async (id: string, input: Partial<CollectionSavedView<StorySettings>>) =>
      setSavedViews((current) => current.map((view) => (view.id === id ? { ...view, ...input } : view))),
    onDeleteView: async (id: string) => setSavedViews((current) => current.filter((view) => view.id !== id)),
    onSetDefaultView: async () => undefined,
  };
  const views = useCollectionViews({ storageKey, initialState, viewsSource });
  const reset = useCollectionViewStore(storageKey, initialState, (state) => state.reset);
  const activateView = useCollectionViewStore(storageKey, initialState, (state) => state.activateView);
  const currentSorts = useCollectionViewStore(storageKey, initialState, (state) => state.sorts);
  const setSorts = useCollectionViewStore(storageKey, initialState, (state) => state.setSorts);
  // Each story starts from its first view, then applies its edits. This runs during the first
  // render, so the bar's own effects and the play function see the story's state.
  useState(() => {
    reset();
    if (savedViews[0]) activateView(savedViews[0]);
    if (editedSorts) setSorts(editedSorts);
  });

  return (
    <Box bg="bg">
      <CollectionViewBar
        itemLabel="Ticket"
        storageKey={storageKey}
        initialState={initialState}
        views={views.views}
        defaultViewId={views.defaultId}
        viewsSource={viewsSource}
        fields={storyFields}
        optionsFor={storyOptions}
        search={search}
        onSearchChange={setSearch}
        searchResultLabel={search ? "4 of 10" : undefined}
        displayControl={
          <DisplayMenu
            settings={settings}
            groupingOptions={[]}
            displayPropertyOptions={[]}
            onViewModeChange={() => undefined}
            onColumnGroupingChange={() => undefined}
            onRowGroupingChange={() => undefined}
            onDisplayPropertyToggle={() => undefined}
            sortControl={<DisplaySortControl fields={storyFields} sorts={currentSorts} onSortsChange={setSorts} />}
          />
        }
      />
    </Box>
  );
};
