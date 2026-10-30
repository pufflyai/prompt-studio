import { expect, test } from "bun:test";
import { syncPath } from "pstdio-sync-contracts";
import { observeTraffic } from "./traffic";

test("traffic measurements count actual streamed bytes and identify the start of a multipart transfer", async () => {
  const server = Bun.serve({ port: 0, fetch: () => new Response(new Uint8Array([1, 2, 3])) });
  const origin = server.url.origin;
  const traffic = observeTraffic(origin);
  try {
    traffic.actor("fixture-token", "sender");
    traffic.phase("large-upload");
    const started = traffic.nextPart("sender");
    const response = fetch(
      `${origin}${syncPath({ kind: "part", projectId: "project", spaceOwner: null, blobId: "b".repeat(16), number: 1 })}`,
      {
        method: "PUT",
        headers: { authorization: "Bearer fixture-token" },
        body: new Uint8Array(10),
      },
    );
    expect((await started).blobId).toBe("b".repeat(16));
    await (await response).arrayBuffer();
    expect(traffic.summary()).toEqual([
      {
        actor: "sender",
        phase: "large-upload",
        operation: "part",
        requests: 1,
        sentBytes: 10,
        receivedBytes: 3,
        failures: 0,
      },
    ]);
    expect(traffic.samples[0]!.elapsedMs).toBeGreaterThan(0);
  } finally {
    traffic.close();
    await server.stop(true);
  }
});
