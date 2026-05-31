import type { createTagsDBService } from "pstdio-db";

export type TagServiceDeps = {
  tagsDBService: ReturnType<typeof createTagsDBService>;
};

/** @deprecated Legacy core ticket tag service. Ticket tags are owned by the pstdio tickets extension. */
export const createTagService = (deps: TagServiceDeps) => ({
  ...deps.tagsDBService,
});
