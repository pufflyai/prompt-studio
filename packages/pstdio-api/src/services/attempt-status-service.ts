import type { createAttemptStatusesDBService } from "pstdio-db";

export type AttemptStatusServiceDeps = {
  attemptStatusesDBService: ReturnType<typeof createAttemptStatusesDBService>;
};

/** @deprecated Legacy core ticket attempt status service. Workspace status automation is extension-owned. */
export const createAttemptStatusService = (deps: AttemptStatusServiceDeps) => ({
  ...deps.attemptStatusesDBService,
});
