import { OpenAPIHono } from "@hono/zod-openapi";
import { BROWSER_LOGIN_FRAGMENT_PARAM } from "pstdio-api-contracts/runtime-auth";
import type { AppBindings } from "../../types";
import {
  type BrowserSessions,
  isRuntimeBearerAuthorized,
  isRuntimeOriginAllowed,
  isRuntimeRequestAuthorized,
} from "./runtime-auth";

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
  browserSessions: BrowserSessions;
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

// The dashboard redeems a login code before it has a session, so this route runs before the
// API's auth middleware. The single-use code is the credential.
export const createBrowserSessionRoutes = (deps: RuntimeRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.post("/browser-session", async (c) => {
    if (!isRuntimeOriginAllowed(c.req.raw, { origin: deps.host.origin, token: deps.host.token })) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const body = await readJson(c.req.raw);
    const code = typeof body === "object" && body !== null ? (body as Record<string, unknown>).code : undefined;
    const secret = typeof code === "string" ? deps.browserSessions.redeemLoginCode(code) : null;
    c.header("cache-control", "no-store");
    if (!secret) return c.json({ error: "Unauthorized" }, 401);
    return c.json({ secret });
  });

  return routes;
};

export const createRuntimeRoutes = (deps: RuntimeRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  const security = { origin: deps.host.origin, token: deps.host.token, browserSessions: deps.browserSessions };

  routes.use("*", async (c, next) => {
    if (!isRuntimeOriginAllowed(c.req.raw, security)) return c.json({ error: "Forbidden" }, 403);
    // Only runtime token holders, the desktop shell and the CLI, may sign a browser in.
    const authorized = c.req.path.endsWith("/browser-login")
      ? isRuntimeBearerAuthorized(c.req.raw, security)
      : isRuntimeRequestAuthorized(c.req.raw, security);
    if (!authorized) return c.json({ error: "Unauthorized" }, 401);
    await next();
  });

  // The code travels in the fragment, so it never reaches a server, a request log, or a Referer.
  routes.post("/browser-login", (c) => {
    const code = deps.browserSessions.createLoginCode();
    return c.json({ url: `${deps.host.origin()}/#${BROWSER_LOGIN_FRAGMENT_PARAM}=${code}` });
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
    let cleanup = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let unsubscribe = () => {};
        const keepalive = () => controller.enqueue(encoder.encode(": keepalive\n\n"));
        const timer = setInterval(keepalive, 1000);
        cleanup = () => {
          clearInterval(timer);
          unsubscribe();
          c.req.raw.signal.removeEventListener("abort", cleanup);
        };
        keepalive();
        unsubscribe = deps.host.subscribe((event) => {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
          controller.close();
          cleanup();
        });
        c.req.raw.signal.addEventListener("abort", cleanup, { once: true });
        if (c.req.raw.signal.aborted) cleanup();
      },
      cancel: () => cleanup(),
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
