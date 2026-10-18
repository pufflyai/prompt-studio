import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAssetFixture, input, newScope, reference } from "./integration-fixture";

const fixture = createAssetFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("resume reads request only the immutable S3 suffix and verify its returned range", async () => {
  const scope = newScope();
  const bytes = new TextEncoder().encode("prefix and immutable suffix");
  const asset = reference(bytes);
  const ranges: (string | null)[] = [];
  let corrupt = false;
  const proxy = fixture.proxy(async (request, response) => {
    const url = new URL(request.url);
    if (request.method === "GET" && !url.searchParams.has("uploadId") && !url.searchParams.has("uploads")) {
      ranges.push(request.headers.get("range"));
      if (corrupt && request.headers.has("range")) {
        const headers = new Headers(response.headers);
        headers.set("content-range", `bytes 0-${bytes.length - 1}/${bytes.length}`);
        return new Response(response.body, { status: response.status, headers });
      }
    }
    return response;
  });
  try {
    await proxy.owner.begin(scope, "range", asset);
    await proxy.owner.writePart(scope, "range", 1, input(bytes));
    await proxy.owner.finish(scope, "range");
    ranges.length = 0;
    const result = await proxy.owner.read(scope, asset, 7);
    expect(new Uint8Array(await new Response(result!.body).arrayBuffer())).toEqual(bytes.subarray(7));
    expect(ranges).toEqual(["bytes=7-"]);
    const empty = await proxy.owner.read(scope, asset, bytes.length);
    expect((await new Response(empty!.body).arrayBuffer()).byteLength).toBe(0);
    expect(ranges).toHaveLength(1);
    corrupt = true;
    const rangeError = await proxy.owner.read(scope, asset, 7).catch((error: unknown) => error);
    expect(rangeError).toMatchObject({ message: expect.stringContaining("range") });
    const offsetError = await proxy.owner.read(scope, asset, bytes.length + 1).catch((error: unknown) => error);
    expect(offsetError).toMatchObject({ message: expect.stringContaining("offset") });
  } finally {
    await proxy.owner.close();
    await proxy.close();
  }
});
