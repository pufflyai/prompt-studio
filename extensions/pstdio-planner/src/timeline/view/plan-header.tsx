import {
  CollectionViewBar,
  type CollectionViewsSource,
  useCollectionViewStore,
  useCollectionViews,
} from "@pstdio/ui/collection-view";
import {
  buildFilterCategories,
  getAttributeStringValues,
  type KanbanRendererSettings,
} from "@pstdio/ui/kanban-renderer";
import { type ReactNode, useEffect } from "react";
import { TimelineDisplayMenu } from "./timeline-display-menu";
import { timelineInitialState, type timelineQueryData } from "./timeline-query";

interface PlanHeaderProps {
  data: ReturnType<typeof timelineQueryData>;
  viewsSource?: CollectionViewsSource<KanbanRendererSettings>;
  search: string;
  onSearchChange: (value: string) => void;
  resultLabel: string;
  actions?: ReactNode;
}

export function PlanHeader(props: PlanHeaderProps) {
  const { data, viewsSource, search, onSearchChange, resultLabel, actions } = props;
  const { settings, setSettings } = useCollectionViewStore(data.storageKey, timelineInitialState, (state) => state);
  // Reconcile the restored draft before the shared controls activate a fallback or refreshed view.
  useEffect(() => {
    const displayable = new Set(data.attributes.filter((attribute) => attribute.displayable).map(({ id }) => id));
    const displayProperties = settings.displayProperties.filter((id) => displayable.has(id));
    if (displayProperties.length !== settings.displayProperties.length) setSettings({ displayProperties });
  }, [data.attributes, settings.displayProperties, setSettings]);
  const { views } = useCollectionViews({
    storageKey: data.storageKey,
    fields: data.attributes,
    initialState: timelineInitialState,
    viewsSource,
  });
  const categories = buildFilterCategories(data.attributes, data.rows);
  return (
    <CollectionViewBar
      itemLabel="Ticket"
      storageKey={data.storageKey}
      initialState={timelineInitialState}
      views={views}
      viewsSource={viewsSource}
      fields={data.attributes}
      optionsFor={(field) => {
        const counts = new Map<string, number>();
        for (const row of data.rows) {
          for (const value of new Set(getAttributeStringValues(row, field)))
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return (categories.find(({ id }) => id === field.id)?.options ?? []).map((option) => ({
          ...option,
          count: counts.get(option.value) ?? 0,
        }));
      }}
      search={search}
      onSearchChange={onSearchChange}
      searchResultLabel={resultLabel}
      displayControl={<TimelineDisplayMenu storageKey={data.storageKey} attributes={data.attributes} />}
      actions={actions}
    />
  );
}
