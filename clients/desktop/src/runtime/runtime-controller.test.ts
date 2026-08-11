import { describe, expect, test } from "bun:test";
import {
  classifyRuntimeFailure,
  createSidecarLaunchArguments,
  reconcileRuntimeOwnership,
  verifyExternalRuntime,
  waitForDesktopRuntime,
} from "./runtime-controller";

const descriptor = {
  schemaVersion: 1 as const,
  protocolVersion: 1 as const,
  pid: 1234,
  instanceId: "runtime-one",
  ownerType: "desktop" as const,
  origin: "http://127.0.0.1:43127" as const,
  token: "runtime-secret",
  appVersion: "0.25.2",
  startedAt: "2026-08-06T08:00:00.000Z",
};

describe("desktop runtime controller", () => {
  test("spawns a desktop-owned loopback runtime without putting secrets in arguments", () => {
    const args = createSidecarLaunchArguments("runtime-one");

    expect(args).toEqual([
      "serve",
      "--foreground",
      "--owner",
      "desktop",
      "--instance-id",
      "runtime-one",
      "--host",
      "127.0.0.1",
      "--port",
      "0",
    ]);
    expect(args.join(" ")).not.toContain("token");
  });

  test("waits for matching authenticated discovery after spawn", async () => {
    const discoveries = [{ state: "missing" as const }, { state: "healthy" as const, descriptor }];

    const result = await waitForDesktopRuntime("/tmp/runtime.json", "runtime-one", {
      discover: async () => discoveries.shift()!,
      now: () => 1,
      sleep: async () => {},
    });

    expect(result).toEqual(descriptor);
  });

  test("verifies an external runtime without inspecting its host PID", async () => {
    let request: Request | undefined;

    await expect(
      verifyExternalRuntime(descriptor, async (input, init) => {
        request = new Request(input, init);
        return Response.json({
          ok: true,
          protocolVersion: 1,
          instanceId: descriptor.instanceId,
          ownerType: descriptor.ownerType,
        });
      }),
    ).resolves.toBe(descriptor);

    expect(request!.url).toBe(`${descriptor.origin}/runtime/ready`);
    expect(request!.headers.get("authorization")).toBe(`Bearer ${descriptor.token}`);
  });

  test("rejects an external descriptor for a replacement runtime", async () => {
    await expect(
      verifyExternalRuntime(descriptor, async () =>
        Response.json({ ok: true, protocolVersion: 1, instanceId: "replacement", ownerType: "persistent" }),
      ),
    ).rejects.toThrow("External runtime identity did not match");
  });

  test("observes desktop-to-persistent promotion before deciding how to quit", () => {
    expect(
      reconcileRuntimeOwnership(descriptor, {
        state: "healthy",
        descriptor: { ...descriptor, ownerType: "persistent" },
      }).ownerType,
    ).toBe("persistent");
    expect(
      reconcileRuntimeOwnership(descriptor, {
        state: "healthy",
        descriptor: { ...descriptor, instanceId: "replacement", ownerType: "persistent" },
      }).ownerType,
    ).toBe("desktop");
  });

  test("classifies actionable startup failures", () => {
    expect(classifyRuntimeFailure("listen EADDRINUSE: address already in use").code).toBe("port_bind_failure");
    expect(classifyRuntimeFailure("PGlite database is already locked").code).toBe("pglite_ownership_conflict");
    expect(classifyRuntimeFailure("invalid checkpoint record").code).toBe("pglite_recovery_failure");
  });
});
