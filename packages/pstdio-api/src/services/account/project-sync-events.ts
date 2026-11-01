import type { ProjectSyncStatus } from "pstdio-api-contracts";
import { createStatusEvents } from "./status-events";

export const createProjectSyncEvents = (input: {
  status: (projectId: string) => Promise<ProjectSyncStatus>;
  publish: (projectId: string, status: ProjectSyncStatus) => void;
}) => createStatusEvents(input);
