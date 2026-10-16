import type { BoardView } from "@pstdio/sdk/extensions";
import type { CollectionViewsSource } from "@pstdio/ui/collection-view";
import type { KanbanRendererSettings } from "@pstdio/ui/kanban-renderer";
import type { PlanClient } from "./use-plan";

const ticketView = (view: BoardView) => ({ ...view, settings: view.settings as KanbanRendererSettings });

export function timelineViewsSource(
  client: PlanClient,
  value: Awaited<ReturnType<PlanClient["commands"]["timeline.plan.read"]>>["savedViews"],
) {
  const source: CollectionViewsSource<KanbanRendererSettings> = {
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
  return source;
}
