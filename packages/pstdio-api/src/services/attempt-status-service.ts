import type { createAttemptStatusesDBService } from "pstdio-db";

export type AttemptStatusServiceDeps = {
  attemptStatusesDBService: ReturnType<typeof createAttemptStatusesDBService>;
};

export const createAttemptStatusService = (deps: AttemptStatusServiceDeps) => ({
  ...deps.attemptStatusesDBService,
});
