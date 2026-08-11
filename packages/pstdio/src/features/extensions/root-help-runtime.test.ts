import { expect, test } from "bun:test";
import type { RuntimeDescriptor } from "../runtime/runtime-descriptor";
import { resolveRootHelpRuntime } from "./root-help-runtime";

const descriptor: RuntimeDescriptor = {
  schemaVersion: 1,
  protocolVersion: 1,
  pid: 42,
  instanceId: "runtime-1",
  ownerType: "persistent",
  origin: "http://127.0.0.1:43123",
  token: "runtime-token",
  appVersion: "0.25.2",
  startedAt: "2026-08-06T00:00:00.000Z",
};

test("uses the healthy runtime descriptor for root help", async () => {
  const runtime = await resolveRootHelpRuntime(undefined, {
    discoverRuntime: async () => ({ state: "healthy", descriptor }),
    resolveConfiguredApiUrl: () => "http://127.0.0.1:19840",
    resolveDescriptorPath: () => "/tmp/pstdio-runtime.json",
  });

  expect(runtime).toEqual({ apiUrl: descriptor.origin, token: descriptor.token });
});
