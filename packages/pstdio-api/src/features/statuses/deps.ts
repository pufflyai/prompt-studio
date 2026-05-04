import type { RouteDeps } from "../deps";

export type StatusesRouteDeps = Pick<RouteDeps, "eventBus" | "statusService">;
