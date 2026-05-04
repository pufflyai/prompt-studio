import type { RouteDeps } from "../deps";

export type AttemptStatusesRouteDeps = Pick<RouteDeps, "attemptStatusService" | "eventBus">;
