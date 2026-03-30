import type { createStatusesDBService } from "pstdio-db";

export type StatusServiceDeps = {
  statusesDBService: ReturnType<typeof createStatusesDBService>;
};

export const createStatusService = (deps: StatusServiceDeps) => ({
  ...deps.statusesDBService,
});
