import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { createClient } from "./client";

test("asset download streams reject corrupted content before reporting verified completion", async () => {
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("wrong") });
  try {
    const client = createClient({ baseUrl: server.url.origin });
    const asset = {
      sha256: createHash("sha256").update("valid").digest("hex"),
      byteLength: 5,
      mediaType: "text/plain",
    };
    const stream = await client.assets.read({ projectId: "workbench", extensionInstanceId: "instance", asset });
    const failure = await new Response(stream).text().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("Asset integrity mismatch");
  } finally {
    await server.stop(true);
  }
});
