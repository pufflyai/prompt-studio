import { OpenAPIHono, z } from "@hono/zod-openapi";
import { streamSSE } from "hono/streaming";
import { textEditingConnectionSchema, textEditingRequestSchema } from "pstdio-api-contracts";
import { textError } from "../../services/text-editing/errors";
import type { createTextEditingService } from "../../services/text-editing/service";
import type { AppBindings } from "../../types";

const base = "/projects/:projectId/text-editing";
const addressSchema = z.strictObject({ token: z.uuid() });
const requestSchema = addressSchema.extend({ request: textEditingRequestSchema });
const activeSchema = addressSchema.extend({ active: z.boolean() });
/** Runtime authentication protects these routes. A guest only sees its scoped bridge operations. */
export const createTextEditingRoutes = (service: ReturnType<typeof createTextEditingService>) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.onError((error, c) => c.json({ ok: false, error: textError(error) }, 200));
  routes.post(base, async (c) => {
    const scope = textEditingConnectionSchema.parse(await c.req.json());
    return c.json({ ok: true, value: await service.connect(c.req.param("projectId"), scope) });
  });
  routes.post(`${base}/request`, async (c) => {
    const { token, request } = requestSchema.parse(await c.req.json());
    const value = await service.request({ projectId: c.req.param("projectId"), token }, request);
    return c.json({ ok: true, value: value ?? null });
  });
  routes.post(`${base}/prepare-close`, async (c) => {
    const input = addressSchema.parse(await c.req.json());
    await service.prepareClose({ projectId: c.req.param("projectId"), ...input });
    return c.json({ ok: true, value: null });
  });
  routes.post(`${base}/active`, async (c) => {
    const { token, active } = activeSchema.parse(await c.req.json());
    service.setActive({ projectId: c.req.param("projectId"), token }, active);
    return c.json({ ok: true, value: null });
  });
  routes.post(`${base}/disconnect`, async (c) => {
    const input = addressSchema.parse(await c.req.json());
    await service.disconnect({ projectId: c.req.param("projectId"), ...input });
    return c.json({ ok: true, value: null });
  });
  routes.post(`${base}/stream`, async (c) => {
    const input = addressSchema.parse(await c.req.json());
    // Resolve before returning streaming headers, so invalid connections get a typed reply.
    const events: import("pstdio-api-contracts/extension-kernel").TextEditingEvent[] = [];
    let send = (event: (typeof events)[number]) => {
      events.push(event);
    };
    const stop = service.listen({ projectId: c.req.param("projectId"), ...input }, (event) => send(event));
    return streamSSE(c, async (stream) => {
      const finished = Promise.withResolvers<void>();
      const cleanup = () => {
        stop();
        finished.resolve();
      };
      stream.onAbort(cleanup);
      let work = Promise.resolve();
      send = (event) => {
        work = work.then(() => stream.writeSSE({ event: "text", data: JSON.stringify(event) }));
        void work.catch(() => {
          stream.abort();
          cleanup();
        });
      };
      const heartbeat = setInterval(() => {
        work = work.then(() => stream.writeSSE({ event: "ping", data: "{}" }));
        void work.catch(() => {
          stream.abort();
          cleanup();
        });
      }, 8_000);
      try {
        for (const event of events) send(event);
        events.length = 0;
        await stream.writeSSE({ event: "ready", data: "{}" });
        await finished.promise;
      } finally {
        clearInterval(heartbeat);
        cleanup();
      }
    });
  });
  return routes;
};
