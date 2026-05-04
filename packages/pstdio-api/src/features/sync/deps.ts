import type { RouteDeps } from "../deps";

export type SyncRouteDeps = Pick<RouteDeps, "eventBus" | "syncService">;
