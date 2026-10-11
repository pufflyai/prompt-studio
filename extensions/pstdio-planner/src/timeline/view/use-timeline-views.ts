import { type BoardView, viewDataEvents } from "@pstdio/sdk/extensions";
import type { CollectionViewsSource } from "@pstdio/ui/collection-view";
import type { KanbanRendererSettings } from "@pstdio/ui/kanban-renderer";
import { useLiveValue } from "./use-live-value";
import type { PlanClient } from "./use-plan";

const readViews = (client: PlanClient) => client.commands["timeline.views.read"]();
const viewEvents = [viewDataEvents.boardViewsChanged];
const ticketView = (view: BoardView) => ({ ...view, settings: view.settings as KanbanRendererSettings });

export function useTimelineViews(client: PlanClient) {
  const { value, error } = useLiveValue(client, readViews, viewEvents);
  const source: CollectionViewsSource<KanbanRendererSettings> | undefined = value && {
    views: value.views.map(ticketView),
    defaultViewId: value.defaultViewId,
    onCreateView: async (input) => ticketView(await client.commands["timeline.views.create"]({ value: input })),
    onUpdateView: async (id, input) => {
      await client.commands["timeline.views.update"]({ id, value: input });
    },
    onDeleteView: async (id) => {
      await client.commands["timeline.views.delete"]({ id });
    },
    onSetDefaultView: async (id) => {
      await client.commands["timeline.views.default"]({ id: id ?? undefined });
    },
  };
  return { source, error };
}
