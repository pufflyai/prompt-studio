import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { managerOriginSchema } from "../../services/account/manager-client";
import { AccountRequestError, type createNativeAccount } from "../../services/account/native-account";
import type { AppBindings } from "../../types";

const json = <T extends z.ZodType>(schema: T) => ({ content: { "application/json": { schema } } });
const responses = {
  200: { description: "Account result. The device credential stays in the native host.", ...json(z.unknown()) },
  400: { description: "Account request unavailable.", ...json(z.object({ error: z.string() })) },
};
const params = z.object({ id: z.string().min(1) });
const tags = ["Account"];

export const createAccountRoutes = (service: ReturnType<typeof createNativeAccount>) => {
  const routes = new OpenAPIHono<AppBindings>();
  // Account service errors never reach generic API error logging or extension event payloads.
  routes.onError((error, c) =>
    c.json(
      {
        error:
          error instanceof AccountRequestError
            ? error.message
            : "Account request unavailable. Check the login and the account service.",
      },
      400,
    ),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/login",
      tags,
      request: { body: json(z.object({ managerOrigin: managerOriginSchema })) },
      responses,
    }),
    async (c) => c.json(await service.login(c.req.valid("json").managerOrigin), 200),
  );
  routes.openapi(
    createRoute({ method: "get", path: "/account/login/{id}", tags, request: { params }, responses }),
    (c) => c.json(service.loginStatus(c.req.valid("param").id), 200),
  );
  routes.openapi(createRoute({ method: "get", path: "/account", tags, responses }), async (c) =>
    c.json(await service.status(), 200),
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
  return routes;
};
