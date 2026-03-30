import type { createTagsDBService } from "pstdio-db";

export type TagServiceDeps = {
  tagsDBService: ReturnType<typeof createTagsDBService>;
};

export const createTagService = (deps: TagServiceDeps) => ({
  ...deps.tagsDBService,
});
