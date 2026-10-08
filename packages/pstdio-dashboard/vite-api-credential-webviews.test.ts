import { afterEach, expect, test } from "bun:test";
import { createServer } from "vite";
import { createApiCredentialPlugin, createApiProxy } from "./vite-api-credential";

const cleanups: Array<() => unknown> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

test("proxies signed webview assets with their sandbox origin and without the API credential", async () => {
  const upstream = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) =>
      Response.json({ origin: request.headers.get("origin"), authorization: request.headers.get("authorization") }),
  });
  cleanups.push(() => upstream.stop(true));
  const target = `http://127.0.0.1:${upstream.port}`;
  const dashboard = await createServer({
    configFile: false,
    appType: "custom",
    server: { host: "127.0.0.1", port: 0, hmr: false, proxy: createApiProxy(target, "api-token") },
    plugins: [createApiCredentialPlugin({ target, token: "api-token" })],
  });
  cleanups.push(() => dashboard.close());
  await dashboard.listen();
  const address = dashboard.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Dashboard has no port");
  const origin = `http://127.0.0.1:${address.port}`;

  const asset = await fetch(`${origin}/v1/extensions/webviews/signed/lab/viewport/assets/module.js`, {
    headers: { origin: "null" },
  });
  expect(asset.status).toBe(200);
  expect(await asset.json()).toEqual({ origin: "null", authorization: null });

  const api = await fetch(`${origin}/v1/projects`, { headers: { origin } });
  expect(api.status).toBe(200);
  expect(await api.json()).toEqual({ origin: null, authorization: "Bearer api-token" });

  for (const path of ["/v1/projects", "/v1/extensions/webviews-other", "/healthz"]) {
    const response = await fetch(`${origin}${path}`, { headers: { origin: "null" } });
    expect(response.status).toBe(403);
  }
});
