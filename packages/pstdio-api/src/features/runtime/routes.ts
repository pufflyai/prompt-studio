import { OpenAPIHono } from "@hono/zod-openapi";
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

// The browser redeems a login code with a plain navigation, so this route runs before the API's
// auth middleware. The single-use code is the credential.
export const createBrowserLoginRoutes = (deps: RuntimeRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.get("/browser-login", (c) => {
    const code = c.req.query("code");
    // The cookie only works on the exact runtime origin, so a code is not spent anywhere else.
    if (code && new URL(c.req.url).origin === deps.host.origin() && deps.browserSessions.redeemLoginCode(code)) {
      c.header("set-cookie", deps.browserSessions.cookie());
    }
    c.header("cache-control", "no-store");
    // A used or unknown code still opens the dashboard, which explains how to sign in.
    return c.redirect("/", 302);
  });

  return routes;
};

export const createRuntimeRoutes = (deps: RuntimeRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  const security = { origin: deps.host.origin, token: deps.host.token, browserSessions: deps.browserSessions };

  routes.use("*", async (c, next) => {
    if (!isRuntimeOriginAllowed(c.req.raw, security)) return c.json({ error: "Forbidden" }, 403);
    // Only bearer holders, the desktop shell and the CLI, may give a browser its credential.
    const issuesBrowserCredential = c.req.path.endsWith("/browser-session") || c.req.path.endsWith("/browser-login");
    const authorized = issuesBrowserCredential
      ? isRuntimeBearerAuthorized(c.req.raw, security)
      : isRuntimeRequestAuthorized(c.req.raw, security);
    if (!authorized) return c.json({ error: "Unauthorized" }, 401);
    await next();
  });

  routes.post("/browser-session", (c) => {
    c.header("set-cookie", deps.browserSessions.cookie());
    return c.body(null, 204);
  });

  routes.post("/browser-login", (c) => {
    const code = deps.browserSessions.createLoginCode();
    return c.json({ url: `${deps.host.origin()}/runtime/browser-login?code=${code}` });
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
