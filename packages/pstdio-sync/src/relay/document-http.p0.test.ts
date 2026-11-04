import { expect, test } from "bun:test";
import { createDocumentRelay } from "./document-http";

const open = (status: number, features: string[] = []) => {
  const calls: { path: string; body?: unknown; authorization: string | null; protocol: string | null }[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      calls.push({
        path,
        body: request.method === "POST" ? await request.json() : undefined,
        authorization: request.headers.get("authorization"),
        protocol: request.headers.get("pstdio-sync-protocol"),
      });
      if (path.endsWith("/capabilities"))
        return Response.json(status === 200 ? { protocolVersion: 1, features } : { error: "unavailable" }, { status });
      if (path.endsWith("/begin-manifest") && !Array.isArray((calls.at(-1)?.body as { children?: unknown })?.children))
        return Response.json({ error: "invalid-request" }, { status: 400 });
      return Response.json({ partSize: 1024, completed: true, parts: [] });
    },
  });
  const relay = createDocumentRelay({
    origin: server.url.href,
    space: { projectId: "project", spaceOwner: "private" },
    documentId: "document_0123456789abcdef",
    token: async () => "test-token",
    signal: new AbortController().signal,
  });
  return { relay, calls, close: () => server.stop(true) };
};

test("an old relay rejects manifest uploads while its leaf upload contract remains usable", async () => {
  const f = open(404);
  try {
    await expect(f.relay.manifestBlobs()).rejects.toThrow("does not support blob references");
    expect(f.calls).toHaveLength(1);
    await f.relay.blobs.put("blob_0123456789abcdef", new Uint8Array([1]));
    expect(f.calls.at(-1)!.path).toEndWith("/begin");
    expect(f.calls.at(-1)!.body).not.toHaveProperty("children");
  } finally {
    await f.close();
  }
});

test("manifest upload is negotiated once and sends exact children on its explicit route", async () => {
  const f = open(200, ["future-feature", "blob-references-v1"]);
  try {
    const blobs = await f.relay.manifestBlobs();
    const child = "child_0123456789abcdef";
    await blobs.put("parent_0123456789abcdef", new Uint8Array([1]), [child]);
    await blobs.put("parent_123456789abcdef0", new Uint8Array([2]), [child]);
    expect(f.calls.map(({ path }) => path.split("/").at(-1))).toEqual([
      "capabilities",
      "begin-manifest",
      "begin-manifest",
    ]);
    expect(f.calls[1]!.body).toMatchObject({ children: [child], byteLength: 1 });
    expect(f.calls[1]!.path).toContain("/spaces/~private/");
    expect(f.calls.every((call) => call.authorization === "Bearer test-token" && call.protocol === "1")).toBe(true);
  } finally {
    await f.close();
  }
});

test("capability authorization failures and missing support never fall back to ordinary uploads", async () => {
  for (const status of [401, 200]) {
    const f = open(status);
    try {
      await expect(f.relay.manifestBlobs()).rejects.toThrow(
        status === 401 ? "401" : "does not support blob references",
      );
      expect(f.calls).toHaveLength(1);
    } finally {
      await f.close();
    }
  }
});

test("a negotiated manifest uploader cannot downgrade a malformed child list to a leaf upload", async () => {
  const f = open(200, ["blob-references-v1"]);
  try {
    const blobs = await f.relay.manifestBlobs();
    await expect(
      Reflect.apply(blobs.put, undefined, ["parent_0123456789abcdef", new Uint8Array([1]), undefined]),
    ).rejects.toThrow("400");
    expect(f.calls.at(-1)!.path).toEndWith("/begin-manifest");
  } finally {
    await f.close();
  }
});

test("rate-limited requests honor Retry-After and abort immediately during renewal", async () => {
  const controller = new AbortController();
  const limited = Promise.withResolvers<void>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      limited.resolve();
      return new Response(null, { status: 429, headers: { "retry-after": "1" } });
    },
  });
  const relay = createDocumentRelay({
    origin: server.url.origin,
    documentId: "document_0123456789abcdef",
    space: { projectId: "project", spaceOwner: "private" },
    token: async () => "token",
    signal: controller.signal,
  });
  const pending = relay.read(0).then(
    () => false,
    () => true,
  );
  try {
    await limited.promise;
    await Bun.sleep(25);
    controller.abort();
    expect(await Promise.race([pending, Bun.sleep(200).then(() => false)])).toBe(true);
  } finally {
    controller.abort();
    await pending;
    await server.stop(true);
  }
});
