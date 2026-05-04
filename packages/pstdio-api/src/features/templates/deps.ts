import type { RouteDeps } from "../deps";

export type TemplatesRouteDeps = Pick<RouteDeps, "eventBus" | "fileService" | "templateService">;
