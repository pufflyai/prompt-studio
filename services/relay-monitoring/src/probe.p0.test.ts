import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCheckpoint } from "./checkpoint";
import { createProbe } from "./probe";
import type { ProbeConfig } from "./probe-config";

const probeConfig = (origin: string, checkpointDirectory: string) =>
  ({
    enabled: true,
    dedicatedMonitoringAccount: true,
    environment: "test",
    managerOrigin: origin,
    relayOrigin: origin,
    accountId: "owned-account",
    workbenchId: "owned-workbench",
    checkpointDirectory,
    devices: [
      { deviceId: "first", credential: "owned-first", renewalGrant: "owned-first-grant" },
      { deviceId: "second", credential: "owned-second", renewalGrant: "owned-second-grant" },
    ],
    budget: {
      queryOrigin: origin,
      readToken: "owned-read-token-for-this-test-only-32",
      accountAlias: "monitoring",
      maximumBytes: 100 * 1024 ** 2,
    },
  }) satisfies ProbeConfig;

test("failed device access leaves dependent checks unknown while the probe heartbeat stays observable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "relay-monitor-probe-"));
  let writes = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/health") return Response.json({ ok: true });
      if (request.method !== "GET") writes++;
      return new Response(null, { status: 401 });
    },
  });
  try {
    const probe = await createProbe(probeConfig(server.url.href, directory));
    await probe.run(AbortSignal.timeout(2000));
    const metrics = probe.metrics.snapshot();
    expect(metrics.find((value) => value.name.endsWith("check_success") && value.labels.check === "http")?.value).toBe(
      1,
    );
    expect(
      metrics.find((value) => value.name.endsWith("check_success") && value.labels.check === "access")?.value,
    ).toBe(0);
    expect(metrics.find((value) => value.name.endsWith("check_success") && value.labels.check === "sync")?.value).toBe(
      -1,
    );
    expect(metrics.find((value) => value.name.endsWith("prober_heartbeat_timestamp_seconds"))?.value).toBeGreaterThan(
      Date.now() / 1000 - 5,
    );
    expect(writes).toBe(0);
    expect(probe.metrics.render()).not.toContain("owned-account");
  } finally {
    await server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});

test("an expired storage budget request leaves live delivery unknown without recording a failed observation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "relay-monitor-probe-"));
  const deadline = new AbortController();
  const key = { generation: 1, secret: Buffer.alloc(32, 7).toString("base64url") };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      switch (new URL(request.url).pathname) {
        case "/health":
          return Response.json({ ok: true });
        case "/v1/workbenches/owned-workbench/keys":
          return Response.json({ project: [key], personal: [key] });
        case "/v1/environment-access":
          return Response.json({ token: "owned-access", expiresAt: new Date(Date.now() + 60_000).toISOString() });
        case "/prometheus/api/v1/query":
          deadline.abort();
          return new Response(null, { status: 504 });
        default:
          return new Response(null, { status: 404 });
      }
    },
  });
  try {
    const probe = await createProbe(probeConfig(server.url.href, directory));
    await probe.run(AbortSignal.any([deadline.signal, AbortSignal.timeout(2000)]));
    expect(deadline.signal.aborted).toBe(true);
    const metrics = probe.metrics.snapshot();
    expect(metrics.find(({ name, labels }) => name.endsWith("check_success") && labels.check === "access")?.value).toBe(
      1,
    );
    expect(metrics.filter(({ labels }) => labels.check === "live")).toEqual([
      { name: "pstdio_relay_check_success", labels: { environment: "test", check: "live" }, value: -1 },
    ]);
  } finally {
    await server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});

test("a pending operation survives restart without resealing or exposing file permissions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "relay-monitor-journal-"));
  try {
    const first = await createCheckpoint(directory, () => ({
      version: 1,
      documentId: "owned-document",
      lastBlobAt: 0,
      lastMultipartAt: 0,
    }));
    first.state.pendingUpdate = {
      envelope: { updateId: "owned-pending-id", payload: "sealed-by-device", blobIds: [] },
      expected: "owned-hash",
    };
    await first.save();
    const second = await createCheckpoint(directory, () => {
      throw new Error("Must restore the committed checkpoint");
    });
    expect(second.state.pendingUpdate).toEqual(first.state.pendingUpdate);
    expect(JSON.parse(await readFile(join(directory, "checkpoint.json"), "utf8")).documentId).toBe("owned-document");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
