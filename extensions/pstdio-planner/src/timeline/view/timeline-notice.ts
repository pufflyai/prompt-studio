import type { PlanClient } from "./use-plan";

export const reportPlannerError = (client: Pick<PlanClient, "notify">, error: unknown) =>
  client.notify
    .toast({
      type: "error",
      title: "Project Planner",
      message: error instanceof Error ? error.message : String(error),
    })
    .catch(() => {
      // The host owns bridge and connection failures, including unavailable notifications.
    });
