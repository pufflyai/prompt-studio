import { afterEach, expect, test } from "bun:test";
import { createServiceTelemetry } from "./telemetry";

const cleanups: Array<() => unknown> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});
const waitFor = async (read: () => number, expected: number) => {
  for (let attempt = 0; attempt < 100 && read() !== expected; attempt++) await Bun.sleep(10);
  expect(read()).toBe(expected);
};
const enabled = { SERVER_TELEMETRY_ENABLED: "1", TELEMETRY_ENVIRONMENT: "test", TELEMETRY_RELEASE: "0.1.0" };
const capture = (status = 200) => {
  const bodies: unknown[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      bodies.push(await request.json());
      return new Response(null, { status });
    },
  });
  cleanups.push(() => server.stop(true));
  const telemetry = createServiceTelemetry(enabled, "relay", { endpoint: new URL("/i/v0/e/", server.url).href });
  cleanups.push(() => telemetry.close());
  return { telemetry, bodies };
};

test("owned capture receives only fixed diagnostics and deployment tags", async () => {
  const { telemetry, bodies } = capture();
  telemetry.report("request_exception");
  await waitFor(() => bodies.length, 1);
  expect(bodies[0]).toEqual({
    api_key: "phc_CWtFFzVtjHocyACrXxJ3och8zJsJA3JjeqdViTWMN94H",
    event: "$exception",
    properties: {
      distinct_id: "service:relay:test",
      $process_person_profile: false,
      service: "relay",
      environment: "test",
      release: "0.1.0",
      failure: "request_exception",
      $exception_list: [
        {
          type: "ServiceFailure",
          value: "request_exception",
          mechanism: { type: "generic", handled: true, synthetic: true },
        },
      ],
    },
  });
  await waitFor(() => telemetry.counts().sent, 1);
});

test("runtime input cannot forward error messages, content, credentials or custom properties", async () => {
  const { telemetry, bodies } = capture();
  const report = telemetry.report as (failure: unknown) => void;
  for (const input of [
    new Error("Bearer owned-token; content; asset; grant; PRIVATE KEY"),
    { failure: "request_exception", message: "private content", stack: "secret file", token: "owned-token" },
    "Bearer owned-token",
    "toString",
    "__proto__",
  ])
    report(input);
  telemetry.report("sync_snapshot_failed");
  await waitFor(() => telemetry.counts().sent, 1);
  expect(bodies).toHaveLength(1);
  expect(JSON.stringify(bodies)).not.toMatch(/owned-token|private content|secret file|PRIVATE KEY/);
  expect((bodies[0] as { event: string }).event).toBe("service_operation_failed");
});

test("denied delivery does not throw or retry and releases capacity", async () => {
  const { telemetry, bodies } = capture(403);
  expect(telemetry.report("sync_snapshot_failed")).toBeUndefined();
  await waitFor(() => telemetry.counts().failed, 1);
  telemetry.report("sync_replay_failed");
  await waitFor(() => telemetry.counts().failed, 2);
  expect(bodies).toHaveLength(2);
});

test("stalled delivery has bounded admission and shutdown aborts without waiting", async () => {
  let received = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => {
      received++;
      return new Promise<Response>(() => {});
    },
  });
  cleanups.push(() => server.stop(true));
  const telemetry = createServiceTelemetry(enabled, "manager", { endpoint: server.url.href });
  for (let index = 0; index < 100; index++) telemetry.report("request_exception");
  expect(telemetry.counts()).toMatchObject({ attempted: 8, dropped: 92 });
  await waitFor(() => received, 8);
  expect(telemetry.close()).toBeUndefined();
  telemetry.report("request_exception");
  expect(telemetry.counts()).toMatchObject({ attempted: 8, dropped: 93 });
  await waitFor(() => telemetry.counts().failed, 8);
});

test("absent opt-in or invalid deployment tags disable delivery without breaking the service", () => {
  for (const env of [
    {},
    { ...enabled, TELEMETRY_ENVIRONMENT: "private workbench" },
    { ...enabled, TELEMETRY_RELEASE: "Bearer secret" },
  ]) {
    const telemetry = createServiceTelemetry(env, "relay");
    telemetry.report("request_exception");
    expect(telemetry.counts()).toEqual({ attempted: 0, sent: 0, failed: 0, dropped: 1 });
    telemetry.close();
  }
});
