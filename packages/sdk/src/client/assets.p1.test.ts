import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { createClient } from "./client";

test("asset uploads hash a stream and resume after a lost acknowledgement without extension retry code", async () => {
  const data = new Uint8Array(8 * 1024 * 1024 + 64 * 1024).fill(7);
  const expected = {
    sha256: createHash("sha256").update(data).digest("hex"),
    byteLength: data.byteLength,
    mediaType: "application/example",
  };
  let offset = 0;
  const offsets: number[] = [];
  const chunkLengths: number[] = [];
  let completed = false;
  let lostAcknowledgement = false;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      expect(request.headers.get("authorization")).toBe("Bearer asset-token");
      const url = new URL(request.url);
      if (url.pathname.endsWith("/content") && request.method === "POST") {
        offsets.push(Number(url.searchParams.get("offset")));
        expect(offsets.at(-1)).toBe(offset);
        const bytes = new Uint8Array(await request.arrayBuffer());
        chunkLengths.push(bytes.byteLength);
        expect(Buffer.compare(bytes, data.subarray(offset, offset + bytes.byteLength))).toBe(0);
        offset += bytes.byteLength;
      } else if (request.method === "PUT") {
        expect(await request.json()).toEqual({ expected });
      } else if (url.pathname.endsWith("/complete")) {
        expect(offset).toBe(data.byteLength);
        completed = true;
      } else if (request.method === "GET" && url.pathname.includes("/assets/")) {
        return new Response(data);
      }
      return Response.json(
        completed
          ? { status: "complete", operationId: "persisted-operation", asset: expected }
          : {
              status: "staging",
              operationId: "persisted-operation",
              expected,
              uploadedByteLength: offset,
            },
      );
    },
  });
  const faultFetch: typeof fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const response = await fetch(input, init);
      if (init?.method === "POST" && String(input).includes("/content?") && !lostAcknowledgement) {
        lostAcknowledgement = true;
        await response.body?.cancel();
        throw new TypeError("Connection closed after the server stored the chunk");
      }
      return response;
    },
    { preconnect: fetch.preconnect },
  );
  class StreamOnlyBlob extends Blob {
    override arrayBuffer(): Promise<ArrayBuffer> {
      throw new Error("Do not buffer the complete source");
    }
  }
  try {
    const client = createClient({ baseUrl: server.url.origin, token: "asset-token", fetch: faultFetch });
    const owner = { projectId: "workbench", extensionInstanceId: "installed-instance" };
    const asset = await client.assets.upload({
      ...owner,
      operationId: "persisted-operation",
      source: new StreamOnlyBlob([data], { type: expected.mediaType }),
    });
    expect(asset).toEqual(expected);
    expect(lostAcknowledgement).toBe(true);
    expect(offsets).toEqual([0, 8 * 1024 * 1024]);
    expect(Math.max(...chunkLengths)).toBeLessThanOrEqual(8 * 1024 * 1024);
    const downloaded = await new Response(await client.assets.read({ ...owner, asset })).arrayBuffer();
    expect(createHash("sha256").update(new Uint8Array(downloaded)).digest("hex")).toBe(expected.sha256);
  } finally {
    await server.stop(true);
  }
});
