import { expect, test } from "bun:test";
import { createRelayAdapter, serviceAddress } from "./http";

test("service addresses keep their path and reject credentials, queries and fragments", () => {
  expect(serviceAddress("https://relay.example.com")).toBe("https://relay.example.com");
  expect(serviceAddress("https://base.example.com/relay/")).toBe("https://base.example.com/relay");
  expect(serviceAddress("http://127.0.0.1:8080/relay")).toBe("http://127.0.0.1:8080/relay");
  for (const address of [
    "https://user:secret@base.example.com/relay",
    "https://base.example.com/relay?region=eu",
    "https://base.example.com/relay#live",
    "http://base.example.com/relay",
  ])
    expect(() => serviceAddress(address)).toThrow();
});

test("a relay address with a path keeps every request under that path", async () => {
  const paths: string[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => {
      paths.push(new URL(request.url).pathname);
      return new Response("unavailable", { status: 404 });
    },
  });
  const controller = new AbortController();
  try {
    const adapter = createRelayAdapter({
      origin: `${server.url.origin}/relay/`,
      scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
      token: async () => "fixture-access",
      signal: controller.signal,
    });
    await expect(adapter.snapshot()).rejects.toThrow("404");
    expect(paths).toHaveLength(1);
    expect(paths[0]).toStartWith("/relay/v1/");
  } finally {
    controller.abort();
    await server.stop(true);
  }
});

test("missing relay assets return null while authentication and service failures remain errors", async () => {
  let status = 404;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("unavailable", { status }) });
  const controller = new AbortController();
  try {
    const adapter = createRelayAdapter({
      origin: server.url.origin,
      scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
      token: async () => "fixture-access",
      signal: controller.signal,
    });
    const asset = { sha256: "a".repeat(64), byteLength: 1, mediaType: "text/plain" };
    expect(await adapter.assets.get(asset, 0)).toBeNull();
    await expect(adapter.snapshot()).rejects.toThrow("404");
    status = 401;
    await expect(adapter.assets.get(asset, 0)).rejects.toThrow("401");
    status = 503;
    await expect(adapter.assets.get(asset, 0)).rejects.toThrow("503");
  } finally {
    controller.abort();
    await server.stop(true);
  }
});

test("cancelling a request releases its wait for a shared token without waiting for renewal", async () => {
  const token = Promise.withResolvers<string>();
  const requested = Promise.withResolvers<void>();
  const controller = new AbortController();
  const adapter = createRelayAdapter({
    origin: "http://127.0.0.1:1",
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
    token: () => {
      requested.resolve();
      return token.promise;
    },
    signal: controller.signal,
  });
  const result = adapter.snapshot().then(
    () => "unexpected success",
    () => "cancelled",
  );
  try {
    await requested.promise;
    controller.abort();
    expect(await Promise.race([result, Bun.sleep(100).then(() => "still waiting")])).toBe("cancelled");
  } finally {
    token.resolve("late-shared-token");
    await result;
  }
});
