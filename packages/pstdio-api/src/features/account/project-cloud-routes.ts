import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import {
  cloudProjectCatalogSchema,
  cloudProjectDeletionSchema,
  deleteCloudProjectInputSchema,
  downloadCloudProjectResultSchema,
  localRemovalConflictSchema,
  localRemovalPreflightSchema,
  removeLocalProjectInputSchema,
  removeLocalProjectResultSchema,
} from "pstdio-api-contracts";
import { apiLogger } from "../../lib/logger";
import { LocalRemovalPending } from "../../services/account/local-project-removal";
import type { createNativeAccount } from "../../services/account/native-account";
import type { AppBindings } from "../../types";
import { expectedAccountQuery, readExpectedAccount } from "./read-identity";

const tags = ["Account"];
const params = z.object({ id: z.string().min(1) });
const response = <T extends z.ZodType>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
});
const unavailable = response("Account request unavailable.", z.object({ error: z.string() }));

export const registerCloudProjectRoutes = (
  routes: OpenAPIHono<AppBindings>,
  account: ReturnType<typeof createNativeAccount>,
) => {
  routes.openapi(
    createRoute({
      method: "get",
      path: "/account/projects",
      tags,
      responses: {
        200: response("Known cloud projects and outstanding deletions.", cloudProjectCatalogSchema),
        400: unavailable,
      },
    }),
    async (c) => c.json(await account.catalogProjects(), 200),
  );
  routes.openapi(
    createRoute({
      method: "get",
      path: "/account/projects/{id}/local-removal",
      tags,
      request: { params },
      responses: {
        200: response("Local project cleanup and upload certainty.", localRemovalPreflightSchema),
        400: unavailable,
        404: response("Downloaded cloud project not found.", z.object({ error: z.string() })),
      },
    }),
    async (c) => {
      const preflight = await account.inspectLocalRemoval(c.req.valid("param").id);
      return preflight ? c.json(preflight, 200) : c.json({ error: "Downloaded cloud project not found" }, 404);
    },
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/projects/{id}/remove-local",
      tags,
      request: {
        params,
        body: { required: true, content: { "application/json": { schema: removeLocalProjectInputSchema } } },
      },
      responses: {
        200: response("Local copy removed.", removeLocalProjectResultSchema),
        409: response("Confirm that this device may discard unsynced changes.", localRemovalConflictSchema),
        503: response("Local cleanup can be retried.", z.object({ error: z.string() })),
        404: response("Downloaded cloud project not found.", z.object({ error: z.string() })),
        400: unavailable,
      },
    }),
    async (c) => {
      const id = c.req.valid("param").id;
      try {
        const result = await account.removeLocalProject(id, c.req.valid("json"));
        if (!result) return c.json({ error: "Downloaded cloud project not found" }, 404);
        if ("conflict" in result)
          return c.json(
            {
              code: "project_local_removal_discard_required" as const,
              error: "Confirm that this device may discard unsynced changes.",
              details: result.conflict,
            },
            409,
          );
        return c.json(result.removed, 200);
      } catch (error) {
        if (!(error instanceof LocalRemovalPending)) throw error;
        apiLogger.warn(
          { event: "account.local_removal.incomplete", projectId: id, error },
          "Local project cleanup needs a retry",
        );
        return c.json({ error: error.message }, 503);
      }
    },
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/projects/{id}/download",
      tags,
      request: { params },
      responses: {
        200: response("The cloud project is downloaded.", downloadCloudProjectResultSchema),
        202: response("Cloud project download accepted.", downloadCloudProjectResultSchema),
        400: unavailable,
      },
    }),
    async (c) => {
      const result = await account.downloadCloudProject(c.req.valid("param").id);
      return result.presence === "downloaded" ? c.json(result, 200) : c.json(result, 202);
    },
  );
  routes.openapi(
    createRoute({
      method: "get",
      path: "/account/projects/{id}/deletion",
      tags,
      request: {
        params,
        query: expectedAccountQuery,
      },
      responses: {
        200: response("Authoritative deletion status.", cloudProjectDeletionSchema),
        400: unavailable,
        404: response("No deletion for this cloud project.", z.object({ error: z.string() })),
      },
    }),
    async (c) => {
      const expected = readExpectedAccount(c.req.valid("query"));
      const status = await account.cloudProjectDeletion(c.req.valid("param").id, c.req.raw.signal, expected);
      return status ? c.json(status, 200) : c.json({ error: "No deletion for this cloud project" }, 404);
    },
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/projects/{id}/delete-cloud",
      tags,
      request: {
        params,
        body: { required: true, content: { "application/json": { schema: deleteCloudProjectInputSchema } } },
      },
      responses: {
        200: response("Permanent cloud deletion completed.", cloudProjectDeletionSchema),
        202: response("Permanent cloud deletion accepted.", cloudProjectDeletionSchema),
        400: unavailable,
      },
    }),
    async (c) => {
      const status = await account.deleteCloudProject(c.req.valid("param").id, c.req.valid("json"), c.req.raw.signal);
      return status.state === "completed" ? c.json(status, 200) : c.json(status, 202);
    },
  );
};
