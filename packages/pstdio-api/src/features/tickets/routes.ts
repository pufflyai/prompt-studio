import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { createTicketHandler, createTicketRoute } from "./endpoints/create-ticket";
import { createTicketAttemptHandler, createTicketAttemptRoute } from "./endpoints/create-ticket-attempt";
import { deleteTicketHandler, deleteTicketRoute } from "./endpoints/delete-ticket";
import { getTicketHandler, getTicketRoute } from "./endpoints/get-ticket";
import { getTicketFileContentHandler, getTicketFileContentRoute } from "./endpoints/get-ticket-file-content";
import { listTicketFilesHandler, listTicketFilesRoute } from "./endpoints/list-ticket-files";
import { listTicketStatusesHandler, listTicketStatusesRoute } from "./endpoints/list-ticket-statuses";
import { listTicketTagsHandler, listTicketTagsRoute } from "./endpoints/list-ticket-tags";
import { listTicketsHandler, listTicketsRoute } from "./endpoints/list-tickets";
import { updateTicketHandler, updateTicketRoute } from "./endpoints/update-ticket";
import { uploadTicketFileHandler, uploadTicketFileRoute } from "./endpoints/upload-ticket-file";

export const createTicketRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(createTicketRoute, createTicketHandler(deps));
  routes.openapi(createTicketAttemptRoute, createTicketAttemptHandler(deps));
  routes.openapi(listTicketsRoute, listTicketsHandler(deps));
  routes.openapi(getTicketRoute, getTicketHandler(deps));
  routes.openapi(updateTicketRoute, updateTicketHandler(deps));
  routes.openapi(listTicketTagsRoute, listTicketTagsHandler(deps));
  routes.openapi(listTicketStatusesRoute, listTicketStatusesHandler(deps));
  routes.openapi(listTicketFilesRoute, listTicketFilesHandler(deps));
  routes.openapi(uploadTicketFileRoute, uploadTicketFileHandler(deps));
  routes.openapi(getTicketFileContentRoute, getTicketFileContentHandler(deps));
  routes.openapi(deleteTicketRoute, deleteTicketHandler(deps));

  return routes;
};
