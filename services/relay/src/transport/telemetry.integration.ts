import { afterAll, beforeAll, expect, test } from "bun:test";
import { createServiceTelemetry } from "pstdio-service-telemetry";
import { startRelay } from "../service";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("redacted sync failures reach owned capture while denied delivery leaves sync usable", async () => {
  const context = await fixture.context();
  const captures: string[] = [];
  let denied = false;
  const receiver = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      captures.push(await request.text());
      return new Response(null, { status: denied ? 403 : 200 });
    },
  });
  const telemetry = createServiceTelemetry(
    { SERVER_TELEMETRY_ENABLED: "1", TELEMETRY_ENVIRONMENT: "test", TELEMETRY_RELEASE: "owned-fixture" },
    "relay",
    { endpoint: receiver.url.href },
  );
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context, telemetry.report);
  const snapshot = (extension: string) =>
    fetch(new URL(`/v1/workbenches/~${context.scope.workbenchId}/extensions/~${extension}/snapshot`, server.url), {
      headers: { authorization: `Bearer ${context.token}` },
    });
  const waitFor = async (read: () => number, expected: number) => {
    for (let attempt = 0; attempt < 100 && read() !== expected; attempt++) await Bun.sleep(10);
    expect(read()).toBe(expected);
  };
  try {
    expect((await snapshot("uninitialized-private-extension")).status).toBe(409);
    await waitFor(() => telemetry.counts().sent, 1);
    denied = true;
    expect((await snapshot("uninitialized-private-extension")).status).toBe(409);
    await waitFor(() => telemetry.counts().failed, 1);
    expect((await snapshot("notes")).status).toBe(200);
    expect((await fetch(new URL("/health", server.url))).status).toBe(200);
    for (const raw of captures) {
      expect(JSON.parse(raw).properties).toMatchObject({ service: "relay", failure: "sync_snapshot_failed" });
      for (const secret of [
        context.token,
        context.scope.workbenchId,
        context.scope.accountId,
        "uninitialized-private-extension",
        fixture.relayDatabaseUrl,
      ])
        expect(raw).not.toContain(secret);
    }
    expect(captures).toHaveLength(2);
  } finally {
    telemetry.close();
    await server.stop(true);
    await receiver.stop(true);
    await context.close();
  }
});
