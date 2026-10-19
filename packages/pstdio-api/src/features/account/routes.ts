import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { managerOriginSchema } from "../../services/account/manager-client";
import type { createNativeAccount } from "../../services/account/native-account";
import { enrollmentInputSchema } from "../../services/account/native-account";
import type { AppBindings } from "../../types";

const manager = z.object({ managerOrigin: managerOriginSchema });
const account = z.object({ accountId: z.string().min(1) });
const json = <T extends z.ZodType>(schema: T) => ({ content: { "application/json": { schema } } });
const responses = {
  200: { description: "Safe account result. Credentials remain native.", ...json(z.unknown()) },
  400: { description: "Account request unavailable.", ...json(z.object({ error: z.string() })) },
};

export const createAccountRoutes = (service: ReturnType<typeof createNativeAccount>) => {
  const routes = new OpenAPIHono<AppBindings>();
  // Remote auth errors never flow into generic API error logging or extension event payloads.
  routes.onError((_error, c) =>
    c.json({ error: "Account request unavailable. Check sign-in, account ownership and service configuration." }, 400),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/login",
      tags: ["Account"],
      request: { body: json(manager) },
      responses,
    }),
    async (c) => c.json(await service.login(c.req.valid("json").managerOrigin), 200),
  );
  routes.openapi(
    createRoute({
      method: "get",
      path: "/account/login/{id}",
      tags: ["Account"],
      request: { params: z.object({ id: z.string() }) },
      responses,
    }),
    (c) => c.json(service.loginStatus(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({ method: "get", path: "/account", tags: ["Account"], request: { query: manager }, responses }),
    async (c) => c.json(await service.inspect(c.req.valid("query").managerOrigin), 200),
  );
  routes.openapi(
    createRoute({ method: "get", path: "/account/connections", tags: ["Account"], responses }),
    async (c) => c.json(await service.connections(), 200),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/sign-out",
      tags: ["Account"],
      request: { body: json(manager) },
      responses,
    }),
    async (c) => c.json(await service.logout(c.req.valid("json").managerOrigin), 200),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/accounts",
      tags: ["Account"],
      request: { body: json(manager) },
      responses,
    }),
    async (c) => c.json(await service.createAccount(c.req.valid("json").managerOrigin), 200),
  );
  for (const kind of ["workbenches", "environments"] as const) {
    routes.openapi(
      createRoute({
        method: "get",
        path: `/account/accounts/{accountId}/${kind}`,
        tags: ["Account"],
        request: { params: account, query: manager },
        responses,
      }),
      async (c) =>
        c.json(await service.list(c.req.valid("query").managerOrigin, c.req.valid("param").accountId, kind), 200),
    );
  }
  routes.openapi(
    createRoute({
      method: "post",
      path: "/account/accounts/{accountId}/environments/{environmentId}/revoke",
      tags: ["Account"],
      request: { params: account.extend({ environmentId: z.string().min(1) }), body: json(manager) },
      responses,
    }),
    async (c) => {
      const { accountId, environmentId } = c.req.valid("param");
      return c.json(await service.revoke(c.req.valid("json").managerOrigin, accountId, environmentId), 200);
    },
  );
  routes.openapi(
    createRoute({
      method: "put",
      path: "/projects/{id}/enrollment",
      tags: ["Account"],
      request: { params: z.object({ id: z.string().min(1) }), body: json(enrollmentInputSchema) },
      responses,
    }),
    async (c) =>
      c.json(
        await service.connect(c.req.valid("param").id, c.req.valid("json") as z.input<typeof enrollmentInputSchema>),
        200,
      ),
  );
  return routes;
};
