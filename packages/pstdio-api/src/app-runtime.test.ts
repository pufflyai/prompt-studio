import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
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

describe("runtime authentication", () => {
  test("provisions an HttpOnly strict session cookie without returning the token", async () => {
    const res = await handle.app.request(`${runtimeOrigin}/runtime/browser-session`, {
      method: "POST",
      headers: {
        authorization: "Bearer runtime-secret",
        origin: runtimeOrigin,
      },
    });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(res.headers.getSetCookie()).toEqual([
      "pstdio_runtime_session=runtime-secret; Path=/; HttpOnly; SameSite=Strict",
    ]);
  });

  test("accepts exact-origin cookie auth for REST and SSE", async () => {
    const provision = await handle.app.request(`${runtimeOrigin}/runtime/browser-session`, {
      method: "POST",
      headers: { authorization: "Bearer runtime-secret", origin: runtimeOrigin },
    });
    const cookie = provision.headers.get("set-cookie")!.split(";", 1)[0]!;

    const rest = await handle.app.request(`${runtimeOrigin}/v1/projects`, {
      headers: { cookie, origin: runtimeOrigin },
    });
    expect(rest.status).toBe(200);

    const controller = new AbortController();
    const sse = await handle.app.request(`${runtimeOrigin}/v1/sync/stream`, {
      headers: { cookie, origin: runtimeOrigin },
      signal: controller.signal,
    });
    expect(sse.status).toBe(200);
    expect(sse.headers.get("content-type")).toContain("text/event-stream");
    controller.abort();
    await sse.body?.cancel();
  });

  test("allows signed read-only webview assets from opaque origins without cookies", async () => {
    const basePath = handle.deps.extensionWebviewAccess
      .runtimeUrl({ installName: "missing", webviewId: "missing" })
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
        installName: "missing",
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
