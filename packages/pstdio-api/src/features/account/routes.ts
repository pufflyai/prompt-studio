import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { deviceCommandSchema } from "pstdio-api-contracts";
import { managerOriginSchema } from "../../services/account/manager-client";
import {
  AccountRequestError,
  accountUnavailableMessage,
  type createNativeAccount,
} from "../../services/account/native-account";
import type { AppBindings } from "../../types";
import { enforceDeviceCommandBodyLimit } from "./device-command-body";
import { expectedAccountQuery, expectedProjectAccountQuery, readExpectedAccount } from "./read-identity";

const json = <T extends z.ZodType>(schema: T) => ({ content: { "application/json": { schema } } });
const responses = {
  200: { description: "Account result. The device credential stays in the native host.", ...json(z.unknown()) },
  400: { description: "Account request unavailable.", ...json(z.object({ error: z.string() })) },
};
const params = z.object({ id: z.string().min(1) });
const tags = ["Account"];

export const createAccountRoutes = (service: ReturnType<typeof createNativeAccount>) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.use("/account/projects/:id/devices/:deviceId/commands", enforceDeviceCommandBodyLimit);
  // Account service errors never reach generic API error logging or extension event payloads.
  routes.onError((error, c) =>
    c.json({ error: error instanceof AccountRequestError ? error.message : accountUnavailableMessage }, 400),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/projects/{id}/devices/{deviceId}/commands",
      tags,
      request: {
        params: params.extend({ deviceId: z.string().min(1) }),
        body: { required: true, ...json(deviceCommandSchema) },
      },
      responses: {
        ...responses,
        413: { description: "The encoded remote command exceeds 64 MiB.", ...json(z.object({ error: z.string() })) },
      },
    }),
    async (c) => {
      const { id, deviceId } = c.req.valid("param");
      const result: unknown = await service.sendDeviceCommand(id, deviceId, c.req.valid("json"), c.req.raw.signal);
      return c.json(result, 200);
    },
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/login",
      tags,
      request: { body: json(z.object({ managerOrigin: managerOriginSchema.optional() })) },
      responses,
    }),
    async (c) => c.json(await service.login(c.req.valid("json").managerOrigin), 200),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/projects/{id}/sync/sources/{sourceId}/retry",
      tags,
      request: { params: params.extend({ sourceId: z.string().min(1) }) },
      responses,
    }),
    async (c) => {
      const { id, sourceId } = c.req.valid("param");
      return c.json(await service.retryProjectSync(id, sourceId), 200);
    },
  );
  routes.openapi(
    createRoute({ method: "get", path: "/account/login/{id}", tags, request: { params }, responses }),
    (c) => c.json(service.loginStatus(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({ method: "delete", path: "/account/login/{id}", tags, request: { params }, responses }),
    async (c) => c.json(await service.cancelLogin(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({
      method: "get",
      path: "/account/projects/{id}/sync",
      tags,
      request: { params, query: expectedProjectAccountQuery },
      responses,
    }),
    async (c) => {
      const query = c.req.valid("query");
      return c.json(
        await service.projectSyncStatus(
          c.req.valid("param").id,
          c.req.raw.signal,
          query.local === "true" ? null : readExpectedAccount(query),
        ),
        200,
      );
    },
  );
  routes.openapi(
    createRoute({ method: "post", path: "/account/projects/{id}/retry", tags, request: { params }, responses }),
    async (c) => c.json(await service.retryProjectSync(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({
      method: "get",
      path: "/account",
      description: "Read login, Cloud projects and account feature grants.",
      tags,
      responses,
    }),
    async (c) => c.json(await service.status(), 200),
  );
  routes.openapi(createRoute({ method: "post", path: "/account/logout", tags, responses }), async (c) =>
    c.json(await service.logout(), 200),
  );
  routes.openapi(
    createRoute({ method: "get", path: "/account/devices", tags, request: { query: expectedAccountQuery }, responses }),
    async (c) => {
      const query = c.req.valid("query");
      const expected = readExpectedAccount(query);
      return c.json(await service.devices(c.req.raw.signal, expected), 200);
    },
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/devices/{id}/rename",
      tags,
      request: { params, body: json(z.object({ name: z.string() })) },
      responses,
    }),
    async (c) => c.json(await service.renameDevice(c.req.valid("param").id, c.req.valid("json").name), 200),
  );
  routes.openapi(
    createRoute({ method: "post", path: "/account/devices/{id}/remove", tags, request: { params }, responses }),
    async (c) => c.json(await service.removeDevice(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({ method: "put", path: "/account/projects/{id}", tags, request: { params }, responses }),
    async (c) => c.json(await service.syncProject(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({ method: "delete", path: "/account/projects/{id}", tags, request: { params }, responses }),
    async (c) => c.json(await service.stopProjectSync(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/projects/{id}/returned-changes",
      description: "Apply or discard changes held for review on this device, or clear its replaced-changes list.",
      tags,
      request: { params, body: json(z.object({ action: z.enum(["apply", "discard", "dismiss"]) })) },
      responses,
    }),
    async (c) => c.json(await service.resolveReturnedChanges(c.req.valid("param").id, c.req.valid("json").action), 200),
  );
  return routes;
};
