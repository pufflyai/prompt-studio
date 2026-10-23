import { expect, test } from "bun:test";
import { createDocumentRelay } from "./document-http";

const open = (body: Uint8Array<ArrayBuffer>, byteLength?: string) => {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname.endsWith("/capabilities"))
        return Response.json({ protocolVersion: 1, features: ["blob-references-v1"] });
      return new Response(body, { headers: byteLength === undefined ? {} : { "pstdio-byte-length": byteLength } });
    },
  });
  const relay = createDocumentRelay({
    origin: server.url.origin,
    space: { projectId: "bounded", spaceOwner: null },
    documentId: "document_0123456789abcdef",
    token: async () => "fixture",
    signal: new AbortController().signal,
  });
  return { relay, close: () => server.stop(true) };
};

test("manifest downloads reject bodies outside the exact authenticated extent", async () => {
  for (const [body, declared, expected] of [
    [new Uint8Array([1, 2, 3]), undefined, 2],
    [new Uint8Array([1]), undefined, 2],
    [new Uint8Array([1, 2]), "3", 2],
  ] as const) {
    const fixture = open(body, declared);
    try {
      const blobs = await fixture.relay.manifestBlobs();
      await expect(blobs.get("blob_0123456789abcdef", expected)).rejects.toThrow("length");
    } finally {
      await fixture.close();
    }
  }
});

test("manifest downloads return exact bytes while ordinary downloads retain their API", async () => {
  const body = new Uint8Array([1, 2, 3]);
  const fixture = open(body, "3");
  try {
    const blobs = await fixture.relay.manifestBlobs();
    expect(await blobs.get("blob_0123456789abcdef", 3)).toEqual(body);
    expect(await fixture.relay.blobs.get("blob_0123456789abcdef")).toEqual(body);
  } finally {
    await fixture.close();
  }
});
