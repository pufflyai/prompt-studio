import type { RouteDeps } from "../deps";

export type HealthRouteDeps = Pick<RouteDeps, "readiness">;
