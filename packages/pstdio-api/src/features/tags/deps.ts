import type { RouteDeps } from "../deps";

export type TagsRouteDeps = Pick<RouteDeps, "eventBus" | "tagService">;
