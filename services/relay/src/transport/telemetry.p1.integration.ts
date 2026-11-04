import { afterAll, beforeAll, expect, test } from "bun:test";
import { Client } from "pg";
import { createServiceTelemetry } from "pstdio-service-telemetry";
import { syncPath, syncProtocolHeader, syncProtocolVersion } from "pstdio-sync-contracts";
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
  const database = new Client({ connectionString: fixture.relayDatabaseUrl });
  await database.connect();
  const read = () =>
    fetch(
      new URL(
        syncPath({
          kind: "document",
          projectId: context.scope.workbenchId,
          spaceOwner: null,
          documentId: "private-document",
          operation: "read",
        }),
        server.url,
      ),
      {
        method: "POST",
        body: JSON.stringify({ after: 0 }),
        headers: { authorization: `Bearer ${context.token}`, [syncProtocolHeader]: String(syncProtocolVersion) },
      },
    );
  const waitFor = async (read: () => number, expected: number) => {
    for (let attempt = 0; attempt < 100 && read() !== expected; attempt++) await Bun.sleep(10);
    expect(read()).toBe(expected);
  };
  try {
    await database.query("ALTER TABLE relay_sync_documents RENAME TO unavailable_documents");
    expect((await read()).status).toBe(503);
    await waitFor(() => telemetry.counts().sent, 1);
    denied = true;
    expect((await read()).status).toBe(503);
    await waitFor(() => telemetry.counts().failed, 1);
    await database.query("ALTER TABLE unavailable_documents RENAME TO relay_sync_documents");
    expect((await read()).status).toBe(200);
    expect((await fetch(new URL("/health", server.url))).status).toBe(200);
    for (const raw of captures) {
      expect(JSON.parse(raw).properties).toMatchObject({ service: "relay", failure: "sync_document_failed" });
      for (const secret of [
        context.token,
        context.scope.workbenchId,
        context.scope.accountId,
        "private-document",
        fixture.relayDatabaseUrl,
      ])
        expect(raw).not.toContain(secret);
    }
    expect(captures).toHaveLength(2);
  } finally {
    await database.query("ALTER TABLE IF EXISTS unavailable_documents RENAME TO relay_sync_documents");
    await database.end();
    telemetry.close();
    await server.stop(true);
    await receiver.stop(true);
    await context.close();
  }
});
