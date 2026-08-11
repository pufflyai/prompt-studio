import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import {
  isRuntimeBearerAuthorized,
  isRuntimeOriginAllowed,
  isRuntimeRequestAuthorized,
  runtimeSessionCookie,
} from "./runtime-auth";

export { runtimeSessionCookie } from "./runtime-auth";

export type RuntimeOwnerType = "desktop" | "persistent";

export type RuntimeActivityItem = {
  id: string;
  label: string;
};

export type RuntimeActivitySummary = {
  sessions: RuntimeActivityItem[];
  terminals: RuntimeActivityItem[];
  jobs: RuntimeActivityItem[];
};

type RuntimeControlEvent = {
  type: "intentional_shutdown";
  instanceId: string;
};

export interface RuntimeHost {
  instanceId: string;
  token: string;
  origin: () => string | null;
  ownerType: () => RuntimeOwnerType;
  promote: () => Promise<void>;
  announceShutdown: () => void;
  subscribe: (listener: (event: RuntimeControlEvent) => void) => () => void;
  shutdown: () => Promise<void>;
}

export type RuntimeRouteDeps = {
  host: RuntimeHost;
  activity: () => Promise<RuntimeActivitySummary>;
  cancelActivity: () => Promise<void>;
};

const isExpectedInstance = (value: unknown, instanceId: string) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return (value as Record<string, unknown>).instanceId === instanceId;
};

const hasActivity = (activity: RuntimeActivitySummary) =>
  activity.sessions.length > 0 || activity.terminals.length > 0 || activity.jobs.length > 0;

const readJson = async (request: Request) => {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
};

export const createRuntimeRoutes = (deps: RuntimeRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  const security = { origin: deps.host.origin, token: deps.host.token };

  routes.use("*", async (c, next) => {
    if (!isRuntimeOriginAllowed(c.req.raw, security)) return c.json({ error: "Forbidden" }, 403);
    const browserProvision = c.req.path.endsWith("/browser-session");
    const authorized = browserProvision
      ? isRuntimeBearerAuthorized(c.req.raw, security)
      : isRuntimeRequestAuthorized(c.req.raw, security);
    if (!authorized) return c.json({ error: "Unauthorized" }, 401);
    await next();
  });

  routes.post("/browser-session", (c) => {
    c.header("set-cookie", runtimeSessionCookie(deps.host.token));
    return c.body(null, 204);
  });

  routes.get("/ready", (c) =>
    c.json({
      instanceId: deps.host.instanceId,
      ok: true as const,
      ownerType: deps.host.ownerType(),
      protocolVersion: 1 as const,
    }),
  );

  routes.get("/activity", async (c) => c.json(await deps.activity()));

  routes.post("/promote", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isExpectedInstance(body, deps.host.instanceId)) {
      return c.json({ error: "runtime_instance_mismatch" }, 409);
    }

    await deps.host.promote();
    return c.json({ instanceId: deps.host.instanceId, ownerType: deps.host.ownerType() });
  });

  routes.post("/shutdown", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isExpectedInstance(body, deps.host.instanceId)) {
      return c.json({ error: "runtime_instance_mismatch" }, 409);
    }

    const force = (body as Record<string, unknown>).force === true;
    const activity = await deps.activity();
    if (hasActivity(activity) && !force) {
      return c.json({ activity, error: "runtime_active" }, 409);
    }

    if (force) await deps.cancelActivity();
    deps.host.announceShutdown();
    setTimeout(() => void deps.host.shutdown(), 0);
    return c.json({ ok: true as const }, 202);
  });

  routes.get("/events", (c) => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let unsubscribe = () => {};
        unsubscribe = deps.host.subscribe((event) => {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
          controller.close();
          unsubscribe();
        });
        c.req.raw.signal.addEventListener("abort", unsubscribe, { once: true });
      },
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-cache",
        "content-type": "text/event-stream",
      },
    });
  });

  return routes;
};
