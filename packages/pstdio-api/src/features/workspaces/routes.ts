import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { WorkspacesRouteDeps } from "./deps";
import { archiveWorkspaceHandler, archiveWorkspaceRoute } from "./endpoints/archive-workspace";
import { createWorkspaceHandler, createWorkspaceRoute } from "./endpoints/create-workspace";
import { deleteWorkspaceHandler, deleteWorkspaceRoute } from "./endpoints/delete-workspace";
import { getStartupLogHandler, getStartupLogRoute } from "./endpoints/get-startup-log";
import { getWorkspaceHandler, getWorkspaceRoute } from "./endpoints/get-workspace";
import {
  getWorkspaceDiffFileHandler,
  getWorkspaceDiffFileRoute,
  getWorkspaceDiffFilesHandler,
  getWorkspaceDiffFilesRoute,
  getWorkspaceDiffHandler,
  getWorkspaceDiffRoute,
} from "./endpoints/get-workspace-diff";
import { getWorkspaceDiffSummaryHandler, getWorkspaceDiffSummaryRoute } from "./endpoints/get-workspace-diff-summary";
import { listWorkspaceActivityHandler, listWorkspaceActivityRoute } from "./endpoints/list-workspace-activity";
import { listWorkspacesHandler, listWorkspacesRoute } from "./endpoints/list-workspaces";
import { removeWorkspaceWorktreeHandler, removeWorkspaceWorktreeRoute } from "./endpoints/remove-worktree";
import { renameWorkspaceHandler, renameWorkspaceRoute } from "./endpoints/rename-workspace";
import { setStartupLogHandler, setStartupLogRoute } from "./endpoints/set-startup-log";
import {
  createWorkspaceDirectoryHandler,
  createWorkspaceDirectoryRoute,
  createWorkspaceFileHandler,
  createWorkspaceFileRoute,
  deleteWorkspaceEntryHandler,
  deleteWorkspaceEntryRoute,
  getWorkspaceFileHandler,
  getWorkspaceFileRoute,
  listWorkspaceFilesHandler,
  listWorkspaceFilesRoute,
  moveWorkspaceEntryHandler,
  moveWorkspaceEntryRoute,
  writeWorkspaceFileHandler,
  writeWorkspaceFileRoute,
} from "./endpoints/workspace-files";

export const createWorkspaceRoutes = (deps: WorkspacesRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(createWorkspaceRoute, createWorkspaceHandler(deps));
  routes.openapi(listWorkspacesRoute, listWorkspacesHandler(deps));
  routes.openapi(getWorkspaceRoute, getWorkspaceHandler(deps));
  routes.openapi(renameWorkspaceRoute, renameWorkspaceHandler(deps));
  routes.openapi(listWorkspaceActivityRoute, listWorkspaceActivityHandler(deps));
  routes.openapi(getWorkspaceDiffRoute, getWorkspaceDiffHandler(deps));
  routes.openapi(getWorkspaceDiffFilesRoute, getWorkspaceDiffFilesHandler(deps));
  routes.openapi(getWorkspaceDiffFileRoute, getWorkspaceDiffFileHandler(deps));
  routes.openapi(getWorkspaceDiffSummaryRoute, getWorkspaceDiffSummaryHandler(deps));
  routes.openapi(listWorkspaceFilesRoute, listWorkspaceFilesHandler(deps));
  routes.openapi(getWorkspaceFileRoute, getWorkspaceFileHandler(deps));
  routes.openapi(createWorkspaceDirectoryRoute, createWorkspaceDirectoryHandler(deps));
  routes.openapi(createWorkspaceFileRoute, createWorkspaceFileHandler(deps));
  routes.openapi(writeWorkspaceFileRoute, writeWorkspaceFileHandler(deps));
  routes.openapi(moveWorkspaceEntryRoute, moveWorkspaceEntryHandler(deps));
  routes.openapi(deleteWorkspaceEntryRoute, deleteWorkspaceEntryHandler(deps));
  routes.openapi(deleteWorkspaceRoute, deleteWorkspaceHandler(deps));
  routes.openapi(archiveWorkspaceRoute, archiveWorkspaceHandler(deps));
  routes.openapi(removeWorkspaceWorktreeRoute, removeWorkspaceWorktreeHandler(deps));
  routes.openapi(setStartupLogRoute, setStartupLogHandler(deps));
  routes.openapi(getStartupLogRoute, getStartupLogHandler(deps));

  return routes;
};
