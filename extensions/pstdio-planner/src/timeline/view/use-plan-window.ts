import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { adjacentPlanWindow, PLAN_WINDOW_SIZE } from "./plan-window";
import { useTimelinePresentation } from "./timeline-presentation";
import { useLiveValue } from "./use-live-value";
import { type PlanClient, planEvents } from "./use-plan";

const readWindow = async (client: PlanClient, request?: string) => {
  if (!request) return;
  const { scope, offset } = JSON.parse(request);
  const input = JSON.parse(scope);
  const plan = await client.commands["timeline.plan.read"]({
    filter: input.filter,
    display: input.display,
    page: {
      limit: PLAN_WINDOW_SIZE,
      offset,
      fields: ["title", "id"],
      search: input.search,
      viewer: {
        locale: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        now: new Date().toISOString(),
      },
    },
  });
  return { scope, offset, plan };
};

export function usePlanWindow(client: PlanClient, filter: ViewFilterGroup, search: string, ready: boolean) {
  const { value: display } = useTimelinePresentation();
  const scope = JSON.stringify({ filter, search, display });
  const [window, setWindow] = useState({ scope, offset: 0 });
  const offset = window.scope === scope ? window.offset : 0;
  const { value } = useLiveValue(client, readWindow, planEvents, ready ? JSON.stringify({ scope, offset }) : undefined);
  const plan = value?.scope === scope ? value.plan : undefined;
  const loading = value?.scope !== scope || value.offset !== offset;
  const move = (direction: "previous" | "next") => {
    if (loading) return;
    const next = adjacentPlanWindow(offset, direction, Boolean(plan?.page.cursor));
    if (next !== offset) setWindow({ scope, offset: next });
  };
  return { plan, paging: { offset: value?.offset ?? 0, loading, hasNext: Boolean(plan?.page.cursor), move } };
}
