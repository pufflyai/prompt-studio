import { CollectionViewBar, type CollectionViewsSource, useCollectionViews } from "@pstdio/ui/collection-view";
import {
  buildFilterCategories,
  getAttributeStringValues,
  type KanbanRendererSettings,
} from "@pstdio/ui/kanban-renderer";
import type { DisplaySettings } from "../contracts";
import { DisplayMenu } from "./display-menu";
import { timelineInitialState, type timelineQueryData } from "./timeline-query";

interface PlanHeaderProps {
  data: ReturnType<typeof timelineQueryData>;
  viewsSource: CollectionViewsSource<KanbanRendererSettings>;
  display: DisplaySettings;
  onDisplayChange: (change: Partial<DisplaySettings>) => void;
  search: string;
  onSearchChange: (value: string) => void;
  resultLabel: string;
}

export function PlanHeader(props: PlanHeaderProps) {
  const { data, viewsSource, display, onDisplayChange, search, onSearchChange, resultLabel } = props;
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
      optionsFor={(field) =>
        (categories.find(({ id }) => id === field.id)?.options ?? []).map((option) => ({
          ...option,
          count: data.rows.filter((row) => getAttributeStringValues(row, field).includes(option.value)).length,
        }))
      }
      search={search}
      onSearchChange={onSearchChange}
      searchResultLabel={resultLabel}
      displayControl={<DisplayMenu display={display} onChange={onDisplayChange} />}
    />
  );
}
