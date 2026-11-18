import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { adjacentPlanWindow, PLAN_WINDOW_SIZE } from "./plan-window";
import { useTimelinePresentation } from "./timeline-presentation";
import { type PlanClient, planEvents } from "./use-plan";
import { usePlannerQuery } from "./use-planner-query";

const viewer = () => ({
  locale: navigator.language,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  now: new Date().toISOString(),
});

export function usePlanWindow(client: PlanClient, filter: ViewFilterGroup, search: string, ready: boolean) {
  const { value: display } = useTimelinePresentation();
  const scope = JSON.stringify({ filter, search, display });
  const [window, setWindow] = useState(() => ({ scope, offset: 0, viewer: viewer() }));
  let current = window;
  if (current.scope !== scope) {
    current = { scope, offset: 0, viewer: viewer() };
    setWindow(current);
  }
  // The viewer clock belongs to this selection, including its subsequent pages.
  const query = client.commands["timeline.plan.read"].query(
    {
      filter,
      display,
      page: {
        limit: PLAN_WINDOW_SIZE,
        offset: current.offset,
        fields: ["title", "id"],
        search,
        viewer: current.viewer,
      },
    },
    { events: planEvents },
  );
  const { value, error, retry } = usePlannerQuery(client, query, ready);
  const plan = ready ? value : undefined;
  const loading = !plan;
  const move = (direction: "previous" | "next") => {
    if (loading) return;
    const next = adjacentPlanWindow(current.offset, direction, Boolean(plan?.page.cursor));
    if (next !== current.offset) setWindow({ ...current, offset: next });
  };
  return { plan, error, retry, paging: { offset: current.offset, loading, hasNext: Boolean(plan?.page.cursor), move } };
}
