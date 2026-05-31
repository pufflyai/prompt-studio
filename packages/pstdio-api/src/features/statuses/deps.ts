import type { RouteDeps } from "../deps";

/** @deprecated Legacy core ticket status route dependencies. Ticket statuses are owned by the pstdio tickets extension. */
export type StatusesRouteDeps = Pick<RouteDeps, "eventBus" | "statusService">;
