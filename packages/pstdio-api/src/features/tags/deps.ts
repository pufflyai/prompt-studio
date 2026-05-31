import type { RouteDeps } from "../deps";

/** @deprecated Legacy core ticket tag route dependencies. Ticket tags are owned by the pstdio tickets extension. */
export type TagsRouteDeps = Pick<RouteDeps, "eventBus" | "tagService">;
