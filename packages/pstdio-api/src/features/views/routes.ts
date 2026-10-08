import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  boardSummarySchema,
  boardViewCreateSchema,
  boardViewSchema,
  boardViewsSchema,
  boardViewUpdateSchema,
} from "pstdio-api-contracts";
import { ProjectNotFoundError } from "../../services/extension-service";
import type { AppBindings } from "../../types";
import { createBoardViewsService } from "./board-views-service";
import type { BoardViewsDeps } from "./resolve-board";
import { BoardViewError } from "./view-rules";

const project = z.object({ projectId: z.string() });
const board = project.extend({ boardId: z.string() });
const view = project.extend({ viewId: z.string() });
const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });
const errors = {
  400: { description: "Invalid view", content: json(z.object({ error: z.string() })) },
  404: { description: "Board or view unavailable", content: json(z.object({ error: z.string() })) },
  409: { description: "A board must keep at least one view", content: json(z.object({ error: z.string() })) },
  503: { description: "Board fields unavailable", content: json(z.object({ error: z.string() })) },
};
const tags = ["Board views"];
const listBoards = createRoute({
  method: "get",
  path: "/projects/{projectId}/boards",
  tags,
  request: { params: project },
  responses: { 200: { description: "Available boards", content: json(z.array(boardSummarySchema)) }, ...errors },
});
const getBoard = createRoute({
  method: "get",
  path: "/projects/{projectId}/boards/{boardId}",
  tags,
  request: { params: board },
  responses: { 200: { description: "Resolved board", content: json(boardSummarySchema) }, ...errors },
});
const getView = createRoute({
  method: "get",
  path: "/projects/{projectId}/board-views/{viewId}",
  tags,
  request: { params: view },
  responses: { 200: { description: "Saved view", content: json(boardViewSchema) }, ...errors },
});
const listViews = createRoute({
  method: "get",
  path: "/projects/{projectId}/boards/{boardId}/views",
  tags,
  request: { params: board },
  responses: { 200: { description: "Board views", content: json(boardViewsSchema) }, ...errors },
});
const listOrphans = createRoute({
  method: "get",
  path: "/projects/{projectId}/board-views",
  tags,
  request: { params: project, query: z.object({ orphaned: z.literal("true") }) },
  responses: { 200: { description: "Orphaned views", content: json(z.array(boardViewSchema)) }, ...errors },
});
const createView = createRoute({
  method: "post",
  path: "/projects/{projectId}/boards/{boardId}/views",
  tags,
  request: { params: board, body: { required: true, content: json(boardViewCreateSchema) } },
  responses: { 201: { description: "Created view", content: json(boardViewSchema) }, ...errors },
});
const updateView = createRoute({
  method: "patch",
  path: "/projects/{projectId}/board-views/{viewId}",
  tags,
  request: { params: view, body: { required: true, content: json(boardViewUpdateSchema) } },
  responses: { 200: { description: "Updated view", content: json(boardViewSchema) }, ...errors },
});
const deleteView = createRoute({
  method: "delete",
  path: "/projects/{projectId}/board-views/{viewId}",
  tags,
  request: { params: view },
  responses: { 200: { description: "Deleted view", content: json(z.object({ deleted: z.boolean() })) }, ...errors },
});
const orderViews = createRoute({
  method: "put",
  path: "/projects/{projectId}/boards/{boardId}/views/order",
  tags,
  request: { params: board, body: { required: true, content: json(z.object({ viewIds: z.array(z.string()) })) } },
  responses: { 200: { description: "Ordered views", content: json(boardViewsSchema) }, ...errors },
});
const defaultView = createRoute({
  method: "put",
  path: "/projects/{projectId}/boards/{boardId}/views/default",
  tags,
  request: { params: board, body: { required: true, content: json(z.object({ viewId: z.string().nullable() })) } },
  responses: { 200: { description: "Default view", content: json(boardViewsSchema) }, ...errors },
});

export const createBoardViewsRoutes = (deps: BoardViewsDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  const service = createBoardViewsService(deps);
  routes.onError((error, c) => {
    if (error instanceof ProjectNotFoundError) return c.json({ error: "Project not found" }, 404);
    if (error instanceof BoardViewError) return c.json({ error: error.message }, error.status);
    throw error;
  });
  routes.openapi(listBoards, async (c) => c.json(await service.boards(c.req.valid("param").projectId), 200));
  routes.openapi(getBoard, async (c) => {
    const p = c.req.valid("param");
    return c.json(await service.board(p.projectId, p.boardId), 200);
  });
  routes.openapi(getView, async (c) => {
    const p = c.req.valid("param");
    return c.json(await service.get(p.projectId, p.viewId), 200);
  });
  routes.openapi(listViews, async (c) => {
    const p = c.req.valid("param");
    return c.json(await service.list(p.projectId, p.boardId), 200);
  });
  routes.openapi(listOrphans, async (c) => c.json(await service.orphaned(c.req.valid("param").projectId), 200));
  routes.openapi(createView, async (c) => {
    const p = c.req.valid("param");
    return c.json(await service.create(p.projectId, p.boardId, c.req.valid("json")), 201);
  });
  routes.openapi(updateView, async (c) => {
    const p = c.req.valid("param");
    return c.json(await service.update(p.projectId, p.viewId, c.req.valid("json")), 200);
  });
  routes.openapi(deleteView, async (c) => {
    const p = c.req.valid("param");
    return c.json(await service.remove(p.projectId, p.viewId), 200);
  });
  routes.openapi(orderViews, async (c) => {
    const p = c.req.valid("param");
    return c.json(await service.reorder(p.projectId, p.boardId, c.req.valid("json").viewIds), 200);
  });
  routes.openapi(defaultView, async (c) => {
    const p = c.req.valid("param");
    return c.json(await service.setDefault(p.projectId, p.boardId, c.req.valid("json").viewId), 200);
  });
  return routes;
};
