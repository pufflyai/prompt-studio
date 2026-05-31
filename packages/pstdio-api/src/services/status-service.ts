import type { createStatusesDBService } from "pstdio-db";

export type StatusServiceDeps = {
  statusesDBService: ReturnType<typeof createStatusesDBService>;
};

/** @deprecated Legacy core ticket status service. Ticket statuses are owned by the pstdio tickets extension. */
export const createStatusService = (deps: StatusServiceDeps) => ({
  ...deps.statusesDBService,
});
