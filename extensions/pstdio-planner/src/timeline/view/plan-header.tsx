import { CollectionViewBar, type CollectionViewsSource, useCollectionViews } from "@pstdio/ui/collection-view";
import {
  buildFilterCategories,
  getAttributeStringValues,
  type KanbanRendererSettings,
} from "@pstdio/ui/kanban-renderer";
import type { ReactNode } from "react";
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
      displayControl={null}
      actions={actions}
    />
  );
}
