import type { createTemplatesDBService } from "pstdio-db";

export type TemplateServiceDeps = {
  templatesDBService: ReturnType<typeof createTemplatesDBService>;
};

export const createTemplateService = (deps: TemplateServiceDeps) => ({
  ...deps.templatesDBService,
});
