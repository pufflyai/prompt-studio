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
    const send = async (route: Parameters<typeof syncPath>[0], body?: Uint8Array) =>
      (
        await fetch(`${origin}${syncPath(route)}`, {
          method: body ? "PUT" : "POST",
          headers: { authorization: "Bearer fixture-token" },
          body,
        })
      ).arrayBuffer();
    const space = { projectId: "project", spaceOwner: null };
    // A record-stream chunk uploads first; only the file upload's first part starts the transfer window.
    await send({ kind: "blob", ...space, blobId: "c".repeat(16), operation: "begin-manifest" });
    await send({ kind: "part", ...space, blobId: "c".repeat(16), number: 1 }, new Uint8Array(4));
    await send({ kind: "blob", ...space, blobId: "b".repeat(16), operation: "begin" });
    const response = send({ kind: "part", ...space, blobId: "b".repeat(16), number: 1 }, new Uint8Array(10));
    expect((await started).blobId).toBe("b".repeat(16));
    await response;
    expect(traffic.summary().filter((row) => row.operation === "part")).toEqual([
      {
        actor: "sender",
        phase: "large-upload",
        operation: "part",
        requests: 2,
        sentBytes: 14,
        receivedBytes: 6,
        failures: 0,
      },
    ]);
    expect(traffic.samples[0]!.elapsedMs).toBeGreaterThan(0);
  } finally {
    traffic.close();
    await server.stop(true);
  }
});
