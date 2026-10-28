import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverRuntime, type RuntimeDescriptor, writeRuntimeDescriptor } from "./runtime-descriptor";

test("keeps the expected live runtime starting after readiness transport failures", async () => {
  const root = mkdtempSync(join(tmpdir(), "runtime-startup-timeout-"));
  const path = join(root, "runtime.json");
  const opened = Promise.withResolvers<void>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 1,
    fetch: async () => {
      await opened.promise;
      return Response.json({ ok: true, protocolVersion: 1, instanceId: "upgrading", ownerType: "desktop" });
    },
  });
  const descriptor: RuntimeDescriptor = {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: process.pid,
    instanceId: "upgrading",
    ownerType: "desktop",
    origin: `http://127.0.0.1:${server.port!}`,
    token: "isolated-startup-token",
    appVersion: "0.46.0",
    startedAt: new Date().toISOString(),
  };
  writeRuntimeDescriptor(path, descriptor);
  try {
    expect(await discoverRuntime(path, { expectedRuntime: descriptor })).toEqual({ state: "starting", descriptor });
    expect(
      await discoverRuntime(path, {
        expectedRuntime: descriptor,
        fetch: async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new TypeError("Readiness connection closed after headers"));
              },
            }),
          ),
      }),
    ).toEqual({ state: "starting", descriptor });
    opened.resolve();
    expect(await discoverRuntime(path, { expectedRuntime: descriptor })).toEqual({ state: "healthy", descriptor });
  } finally {
    opened.resolve();
    server.stop(true);
    rmSync(root, { recursive: true, force: true });
  }
});

test("preserves uncertain ownership when readiness fails without a matching expected process", async () => {
  const root = mkdtempSync(join(tmpdir(), "runtime-startup-ownership-"));
  const path = join(root, "runtime.json");
  const descriptor: RuntimeDescriptor = {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: process.pid,
    instanceId: "upgrading",
    ownerType: "desktop",
    origin: "http://127.0.0.1:43127",
    token: "isolated-startup-token",
    appVersion: "0.46.0",
    startedAt: new Date().toISOString(),
  };
  writeRuntimeDescriptor(path, descriptor);
  const unavailable = async () => {
    throw new TypeError("socket closed");
  };
  try {
    for (const expectedRuntime of [
      undefined,
      { ...descriptor, pid: descriptor.pid + 1 },
      { ...descriptor, instanceId: "replacement" },
    ]) {
      expect(await discoverRuntime(path, { expectedRuntime, fetch: unavailable })).toEqual({
        state: "unsafe",
        reason: "ownership_uncertain",
      });
    }
    for (const response of [
      new Response(null, { status: 401 }),
      new Response("invalid readiness payload", { headers: { "content-type": "application/json" } }),
      Response.json({ ok: true, protocolVersion: 1, instanceId: "replacement", ownerType: "desktop" }),
    ]) {
      expect(await discoverRuntime(path, { expectedRuntime: descriptor, fetch: async () => response })).toEqual({
        state: "unsafe",
        reason: "ownership_uncertain",
      });
    }
    expect(
      await discoverRuntime(path, { expectedRuntime: descriptor, fetch: unavailable, isPidAlive: () => false }),
    ).toEqual({ state: "missing" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
