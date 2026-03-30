import type { createSkillsDBService } from "pstdio-db";
import type { createSkillsStorageService } from "pstdio-storage";

export type SkillServiceDeps = {
  skillsDBService: ReturnType<typeof createSkillsDBService>;
  skillsStorageService: ReturnType<typeof createSkillsStorageService>;
};

export const createSkillService = (deps: SkillServiceDeps) => ({
  ...deps.skillsDBService,
  ...deps.skillsStorageService,
});
