import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { apiWebSocket } from "./app";
import type { RuntimeHost } from "./features/runtime/routes";
import { createTestApp } from "./test-utils/create-test-app";

const runtimeOrigin = "http://127.0.0.1:43123";
const runtimeHost: RuntimeHost = {
  announceShutdown: () => {},
  instanceId: "runtime-one",
  origin: () => runtimeOrigin,
  ownerType: () => "persistent",
  promote: async () => {},
  shutdown: async () => {},
  subscribe: () => () => {},
  token: "runtime-secret",
};

setDefaultTimeout(10_000);

let handle: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  handle = await createTestApp({ host: { kind: "runtime", runtime: runtimeHost } });
  handle.app.get("/v1/test-secret-error", () => {
    throw new Error("failed with runtime-secret");
  });
});

afterAll(async () => {
  await handle?.close();
});

const loginCode = (url: string) => new URLSearchParams(new URL(url).hash.slice(1)).get("browser-login") ?? "";

const redeemLoginCode = (code: string) =>
  handle.app.request(`${runtimeOrigin}/runtime/browser-session`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: runtimeOrigin },
    body: JSON.stringify({ code }),
  });

const signInBrowser = async () => {
  const created = await handle.app.request(`${runtimeOrigin}/runtime/browser-login`, {
    method: "POST",
    headers: { authorization: "Bearer runtime-secret" },
  });
  const { url } = (await created.json()) as { url: string };
  const { secret } = (await (await redeemLoginCode(loginCode(url))).json()) as { secret: string };
  return secret;
};

describe("runtime authentication", () => {
  test("signs a browser in once through a login link that a bearer holder created", async () => {
    const created = await handle.app.request(`${runtimeOrigin}/runtime/browser-login`, {
      method: "POST",
      headers: { authorization: "Bearer runtime-secret" },
    });
    expect(created.status).toBe(200);
    const { url } = (await created.json()) as { url: string };
    expect(url).toStartWith(`${runtimeOrigin}/#browser-login=`);
    expect(url).not.toContain("runtime-secret");

    const code = loginCode(url);
    const redeemed = await redeemLoginCode(code);
    expect(redeemed.status).toBe(200);
    const { secret } = (await redeemed.json()) as { secret: string };
    expect(secret).not.toBe("runtime-secret");

    expect((await redeemLoginCode(code)).status).toBe(401);
  });

  test("only the runtime token can create a login link", async () => {
    const anonymous = await handle.app.request(`${runtimeOrigin}/runtime/browser-login`, { method: "POST" });
    expect(anonymous.status).toBe(401);

    const browser = await handle.app.request(`${runtimeOrigin}/runtime/browser-login`, {
      method: "POST",
      headers: { authorization: `Bearer ${await signInBrowser()}` },
    });
    expect(browser.status).toBe(401);
  });

  test("accepts the browser session as a bearer header for REST and SSE", async () => {
    const authorization = `Bearer ${await signInBrowser()}`;

    const rest = await handle.app.request(`${runtimeOrigin}/v1/projects`, {
      headers: { authorization, origin: runtimeOrigin },
    });
    expect(rest.status).toBe(200);

    const controller = new AbortController();
    const sse = await handle.app.request(`${runtimeOrigin}/v1/sync/stream`, {
      headers: { authorization },
      signal: controller.signal,
    });
    expect(sse.status).toBe(200);
    expect(sse.headers.get("content-type")).toContain("text/event-stream");
    controller.abort();
    await sse.body?.cancel();
  });

  test("rejects the browser session replayed as a cookie by another local server", async () => {
    const cookie = `pstdio_runtime_session=${await signInBrowser()}`;

    const rest = await handle.app.request(`${runtimeOrigin}/v1/projects`, {
      headers: { cookie, host: "127.0.0.1:43123" },
    });
    expect(rest.status).toBe(401);

    const websocket = await handle.app.request(`${runtimeOrigin}/v1/terminal`, {
      headers: { connection: "Upgrade", cookie, host: "127.0.0.1:43123", upgrade: "websocket" },
    });
    expect(websocket.status).toBe(401);
  });

  test("authenticates the terminal WebSocket through its protocol list without echoing the secret", async () => {
    const secret = await signInBrowser();
    const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handle.app.fetch, websocket: apiWebSocket });
    try {
      const socket = new WebSocket(`ws://127.0.0.1:${server.port}/v1/terminal`, ["pstdio", `pstdio.bearer.${secret}`]);
      const protocol = await new Promise<string>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(socket.protocol));
        socket.addEventListener("error", () => reject(new Error("The terminal handshake failed.")));
      });
      socket.close();

      expect(protocol).toBe("pstdio");
    } finally {
      await server.stop(true);
    }
  });

  test("allows signed read-only webview assets from opaque origins without cookies", async () => {
    const basePath = handle.deps.extensionWebviewAccess
      .runtimeUrl({ installedExtensionId: "missing", webviewId: "missing" })
      .replace(/\/runtime$/, "");

    for (const path of [`${basePath}/runtime`, `${basePath}/assets/module.js`]) {
      const response = await handle.app.request(`${runtimeOrigin}${path}`, {
        headers: { origin: "null" },
      });

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBe("null");
      expect(response.headers.get("access-control-allow-credentials")).toBeNull();
      expect(response.headers.get("vary")).toContain("Origin");
    }

    const head = await handle.app.request(`${runtimeOrigin}${basePath}/runtime`, {
      method: "HEAD",
      headers: { origin: "null" },
    });
    expect(head.status).not.toBe(401);
    expect(head.status).not.toBe(403);
    expect(head.headers.get("access-control-allow-origin")).toBe("null");

    const navigation = await handle.app.request(`${runtimeOrigin}${basePath}/runtime`);
    expect(navigation.status).toBe(200);

    const invalidCapability = await handle.app.request(`${runtimeOrigin}${basePath}x/runtime`, {
      headers: { origin: "null" },
    });
    expect(invalidCapability.status).toBe(404);

    const oldAssetPath = await handle.app.request(`${runtimeOrigin}/v1/extensions/runtime.js`, {
      headers: { origin: "null" },
    });
    expect(oldAssetPath.status).toBe(403);

    const nonAsset = await handle.app.request(`${runtimeOrigin}/v1/projects`, {
      headers: { origin: "null" },
    });
    expect(nonAsset.status).toBe(403);

    const mutation = await handle.app.request(`${runtimeOrigin}${basePath}/runtime`, {
      method: "POST",
      headers: { origin: "null" },
    });
    expect(mutation.status).toBe(404);

    const preflight = await handle.app.request(`${runtimeOrigin}${basePath}/runtime`, {
      method: "OPTIONS",
      headers: { origin: "null", "access-control-request-method": "GET" },
    });
    expect(preflight.status).toBe(404);

    const foreign = await handle.app.request(`${runtimeOrigin}${basePath}/runtime`, {
      headers: { origin: "http://attacker.example" },
    });
    expect(foreign.status).toBe(403);
  });

  test("invalidates webview capabilities when the runtime is replaced", async () => {
    const previous = await createTestApp();
    let staleRuntimeUrl: string;
    try {
      staleRuntimeUrl = previous.deps.extensionWebviewAccess.runtimeUrl({
        installedExtensionId: "missing",
        webviewId: "missing",
      });
    } finally {
      await previous.close();
    }
    const response = await handle.app.request(`${runtimeOrigin}${staleRuntimeUrl}`, {
      headers: { origin: "null" },
    });

    expect(response.status).toBe(404);
  });

  test("rejects arbitrary origins and unauthenticated WebSocket handshakes", async () => {
    const foreign = await handle.app.request(`${runtimeOrigin}/v1/projects`, {
      headers: { authorization: "Bearer runtime-secret", origin: "http://attacker.example" },
    });
    expect(foreign.status).toBe(403);

    const websocket = await handle.app.request(`${runtimeOrigin}/v1/terminal`, {
      headers: { connection: "Upgrade", origin: runtimeOrigin, upgrade: "websocket" },
    });
    expect(websocket.status).toBe(401);
  });

  test("allows only exact-origin credentialed preflights", async () => {
    const exact = await handle.app.request(`${runtimeOrigin}/v1/projects`, {
      method: "OPTIONS",
      headers: { origin: runtimeOrigin, "access-control-request-method": "GET" },
    });
    expect(exact.status).toBe(204);
    expect(exact.headers.get("access-control-allow-origin")).toBe(runtimeOrigin);
    expect(exact.headers.get("access-control-allow-credentials")).toBe("true");

    const foreign = await handle.app.request(`${runtimeOrigin}/v1/projects`, {
      method: "OPTIONS",
      headers: { origin: "http://attacker.example", "access-control-request-method": "GET" },
    });
    expect(foreign.status).toBe(403);
  });

  test("keeps only liveness public while protecting readiness details and API documentation", async () => {
    expect((await handle.app.request(`${runtimeOrigin}/healthz`)).status).toBe(200);
    expect((await handle.app.request(`${runtimeOrigin}/ping`)).status).toBe(200);
    expect((await handle.app.request(`${runtimeOrigin}/readyz`)).status).toBe(401);
    expect((await handle.app.request(`${runtimeOrigin}/openapi.json`)).status).toBe(401);
    expect(
      (
        await handle.app.request(`${runtimeOrigin}/readyz`, {
          headers: { authorization: "Bearer runtime-secret" },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await handle.app.request(`${runtimeOrigin}/openapi.json`, {
          headers: { authorization: "Bearer runtime-secret" },
        })
      ).status,
    ).toBe(200);
  });

  test("redacts the runtime token from API error payloads", async () => {
    const response = await handle.app.request(`${runtimeOrigin}/v1/test-secret-error`, {
      headers: { authorization: "Bearer runtime-secret" },
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("failed with [Redacted]");
  });
});

describe("app host ownership", () => {
  test("uses the runtime token when a different standalone token is present", async () => {
    const previousToken = process.env.PSTDIO_API_TOKEN;
    process.env.PSTDIO_API_TOKEN = "standalone-secret";
    const runtimeHost: RuntimeHost = {
      announceShutdown: () => {},
      instanceId: "runtime-with-ambient-token",
      origin: () => runtimeOrigin,
      ownerType: () => "persistent",
      promote: async () => {},
      shutdown: async () => {},
      subscribe: () => () => {},
      token: "runtime-secret",
    };

    const handle = await createTestApp({
      databasePath: ":memory:",
      host: { kind: "runtime", runtime: runtimeHost },
    });

    try {
      const response = await handle.app.request(`${runtimeOrigin}/runtime/ready`, {
        headers: { authorization: "Bearer runtime-secret" },
      });

      expect(response.status).toBe(200);
    } finally {
      await handle.close();
      if (previousToken === undefined) {
        delete process.env.PSTDIO_API_TOKEN;
      } else {
        process.env.PSTDIO_API_TOKEN = previousToken;
      }
    }
  });
});
