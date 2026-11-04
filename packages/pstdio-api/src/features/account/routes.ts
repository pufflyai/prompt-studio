import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  cloudDeviceProviderSchema,
  deviceCommandSchema,
  prepareCloudDeviceBootstrapSchema,
  startCloudDeviceSchema,
} from "pstdio-api-contracts";
import { CloudDeviceRequestError } from "../../services/account/cloud-device-provider";
import { managerOriginSchema } from "../../services/account/manager-client";
import {
  AccountRequestError,
  accountUnavailableMessage,
  type createNativeAccount,
} from "../../services/account/native-account";
import type { AppBindings } from "../../types";
import { enforceDeviceCommandBodyLimit } from "./device-command-body";

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
    c.json(
      {
        error:
          error instanceof AccountRequestError || error instanceof CloudDeviceRequestError
            ? error.message
            : accountUnavailableMessage,
      },
      400,
    ),
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
    createRoute({ method: "get", path: "/account/login/{id}", tags, request: { params }, responses }),
    (c) => c.json(service.loginStatus(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({ method: "delete", path: "/account/login/{id}", tags, request: { params }, responses }),
    async (c) => c.json(await service.cancelLogin(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({ method: "get", path: "/account/projects/{id}/sync", tags, request: { params }, responses }),
    async (c) => c.json(await service.projectSyncStatus(c.req.valid("param").id), 200),
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
  routes.openapi(createRoute({ method: "get", path: "/account/devices", tags, responses }), async (c) =>
    c.json(await service.devices(), 200),
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
  routes.openapi(createRoute({ method: "get", path: "/account/cloud/provider", tags, responses }), async (c) =>
    c.json(await service.cloudDeviceProvider(), 200),
  );
  routes.openapi(
    createRoute({
      method: "put",
      path: "/account/cloud/provider",
      tags,
      request: { body: { required: true, ...json(cloudDeviceProviderSchema) } },
      responses,
    }),
    async (c) => c.json(await service.configureCloudDeviceProvider(c.req.valid("json")), 200),
  );
  routes.openapi(createRoute({ method: "get", path: "/account/cloud/devices", tags, responses }), async (c) =>
    c.json(await service.cloudDevices(), 200),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/cloud/devices/start",
      tags,
      request: { body: { required: true, ...json(startCloudDeviceSchema) } },
      responses,
    }),
    async (c) => c.json(await service.startCloudDevice(c.req.valid("json")), 200),
  );
  routes.openapi(
    createRoute({ method: "post", path: "/account/cloud/devices/{id}/stop", tags, request: { params }, responses }),
    async (c) => c.json(await service.stopCloudDevice(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/cloud/bootstrap",
      tags,
      request: { body: { required: true, ...json(prepareCloudDeviceBootstrapSchema) } },
      responses,
    }),
    async (c) => c.json(await service.prepareCloudDeviceBootstrap(c.req.valid("json")), 200),
  );
  return routes;
};
