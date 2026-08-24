import { createRoute, z } from "@hono/zod-openapi";
import {
  listWorkspaceFilesQuerySchema,
  moveWorkspaceEntryBodySchema,
  notFoundResponseSchema,
  workspaceFileContentSchema,
  workspaceFileEntrySchema,
  workspaceFilePathQuerySchema,
  workspaceFilesResponseSchema,
  writeWorkspaceFileBodySchema,
} from "../dto";

const errorResponse = {
  description: "Workspace file request failed.",
  content: { "application/json": { schema: notFoundResponseSchema } },
};

export const listWorkspaceFilesRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/files",
  description: "List or search files in a workspace.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
    query: listWorkspaceFilesQuerySchema,
  },
  responses: {
    200: {
      description: "Workspace file entries.",
      content: { "application/json": { schema: workspaceFilesResponseSchema } },
    },
    400: errorResponse,
    404: errorResponse,
    413: errorResponse,
    415: errorResponse,
  },
});

export const getWorkspaceFileRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/file",
  description: "Read an existing workspace text file or supported image.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
    query: workspaceFilePathQuerySchema,
  },
  responses: {
    200: {
      description: "Workspace file content.",
      content: { "application/json": { schema: workspaceFileContentSchema } },
    },
    400: errorResponse,
    404: errorResponse,
    413: errorResponse,
    415: errorResponse,
  },
});

export const writeWorkspaceFileRoute = createRoute({
  method: "put",
  path: "/workspaces/{id}/file",
  description: "Replace an existing workspace UTF-8 text file.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
    query: workspaceFilePathQuerySchema,
    body: { content: { "application/json": { schema: writeWorkspaceFileBodySchema } }, required: true },
  },
  responses: {
    200: {
      description: "Updated workspace file content.",
      content: { "application/json": { schema: workspaceFileContentSchema } },
    },
    400: errorResponse,
    404: errorResponse,
    413: errorResponse,
    415: errorResponse,
  },
});

export const createWorkspaceFileRoute = createRoute({
  method: "post",
  path: "/workspaces/{id}/file",
  description: "Create a workspace UTF-8 text file.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
    query: workspaceFilePathQuerySchema,
    body: { content: { "application/json": { schema: writeWorkspaceFileBodySchema } }, required: true },
  },
  responses: {
    201: {
      description: "Created workspace file content.",
      content: { "application/json": { schema: workspaceFileContentSchema } },
    },
    400: errorResponse,
    404: errorResponse,
    409: errorResponse,
    413: errorResponse,
    415: errorResponse,
  },
});

export const createWorkspaceDirectoryRoute = createRoute({
  method: "post",
  path: "/workspaces/{id}/directory",
  description: "Create a workspace directory.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
    query: workspaceFilePathQuerySchema,
  },
  responses: {
    201: {
      description: "Workspace directory created.",
      content: { "application/json": { schema: workspaceFileEntrySchema } },
    },
    400: errorResponse,
    404: errorResponse,
    409: errorResponse,
    415: errorResponse,
  },
});

export const moveWorkspaceEntryRoute = createRoute({
  method: "patch",
  path: "/workspaces/{id}/entry",
  description: "Move or rename an existing workspace file or directory.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
    query: workspaceFilePathQuerySchema,
    body: { content: { "application/json": { schema: moveWorkspaceEntryBodySchema } }, required: true },
  },
  responses: {
    204: { description: "Workspace entry moved." },
    400: errorResponse,
    404: errorResponse,
    409: errorResponse,
    415: errorResponse,
  },
});

export const deleteWorkspaceEntryRoute = createRoute({
  method: "delete",
  path: "/workspaces/{id}/entry",
  description: "Delete an existing workspace file or directory.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
    query: workspaceFilePathQuerySchema,
  },
  responses: {
    204: { description: "Workspace entry deleted." },
    400: errorResponse,
    404: errorResponse,
    415: errorResponse,
  },
});
