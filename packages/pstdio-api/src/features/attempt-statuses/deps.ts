import type { RouteDeps } from "../deps";

/** @deprecated Legacy core ticket attempt status route dependencies. Workspace status automation is extension-owned. */
export type AttemptStatusesRouteDeps = Pick<RouteDeps, "attemptStatusService" | "eventBus">;
