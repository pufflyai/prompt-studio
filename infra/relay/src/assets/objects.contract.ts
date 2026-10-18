import { strict as assert } from "node:assert";
import { createAssetObjects, type ObjectConfig } from "./objects";
import { checkedBytes } from "./streams";

// Reusable provider probe. The caller supplies an existing disposable bucket.
export const checkObjectStorage = async (config: ObjectConfig) => {
  const objects = createAssetObjects(config);
  const prefix = `relay-storage-contract/${crypto.randomUUID()}`;
  const keys = [`${prefix}/verified`, `${prefix}/cancelled`, `${prefix}/empty`];
  const bytes = new Uint8Array(5 * 1024 * 1024 + 32).fill(7);
  const reference = (data: Uint8Array) => ({
    sha256: new Bun.CryptoHasher("sha256").update(data).digest("hex"),
    byteLength: data.byteLength,
    mediaType: "application/octet-stream",
  });
  const input = (data: Uint8Array) => {
    let offset = 0;
    return {
      ...reference(data),
      body: new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            const next = data.subarray(offset, offset + 64 * 1024);
            offset += next.byteLength;
            controller.enqueue(next);
            if (offset === data.byteLength) controller.close();
          },
        },
        new ByteLengthQueuingStrategy({ highWaterMark: 64 * 1024 }),
      ),
    };
  };
  const pending = new Map<string, string>();
  const run = async () => {
    const asset = reference(bytes);
    const upload = await objects.begin(keys[0], asset);
    pending.set(keys[0], upload);
    assert.equal(await objects.begin(keys[0], asset), upload);
    const parts = [];
    for (const [index, part] of [bytes.subarray(0, 5 * 1024 * 1024), bytes.subarray(5 * 1024 * 1024)].entries()) {
      const descriptor = input(part);
      const etag = await objects.write(keys[0], upload, index + 1, descriptor, new AbortController().signal);
      parts.push({ number: index + 1, etag, sha256: descriptor.sha256 });
    }
    await objects.finish(keys[0], upload, parts);
    pending.delete(keys[0]);
    const etag = await objects.verify(keys[0], asset);
    assert.equal((await objects.head(keys[0], etag))?.ContentType, asset.mediaType);
    assert.equal(await objects.head(keys[0], '"different-etag"'), null);
    let length = 0;
    for await (const chunk of checkedBytes(await objects.get(keys[0], etag), asset)) length += chunk.byteLength;
    assert.equal(length, bytes.byteLength);
    const offset = 5 * 1024 * 1024 + 3;
    const suffix = await objects.range(keys[0], etag, asset, offset);
    const received = new Uint8Array(await new Response(suffix).arrayBuffer());
    assert.deepEqual(received, bytes.subarray(offset));
    await assert.rejects(objects.range(keys[0], '"different-etag"', asset, offset));

    const abandoned = await objects.begin(keys[1], asset);
    pending.set(keys[1], abandoned);
    await objects.write(keys[1], abandoned, 1, input(bytes.subarray(0, 5 * 1024 * 1024)), new AbortController().signal);
    await objects.discard(keys[1], abandoned);
    pending.delete(keys[1]);
    assert.equal(await objects.head(keys[1]), null);

    const empty = reference(new Uint8Array());
    await objects.empty(keys[2], empty);
    await objects.verify(keys[2], empty);
    return {
      multipart: true,
      resumedIdentity: true,
      verifiedStream: true,
      conditionalRead: true,
      immutableRange: true,
      cancellation: true,
      emptyObject: true,
    };
  };
  const result = await run().then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  const failures: unknown[] = "error" in result ? [result.error] : [];
  try {
    const results = await Promise.allSettled(
      keys.map(async (key) => {
        // Discover lost Create acknowledgments even when no upload ID was returned.
        const cleanup = await Promise.allSettled([objects.discard(key, pending.get(key) ?? null), objects.remove(key)]);
        const errors = cleanup.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
        if (errors.length) throw new AggregateError(errors, `Storage probe cleanup failed for ${key}`);
      }),
    );
    const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
    failures.push(...errors);
  } finally {
    objects.close();
  }
  if (failures.length) throw new AggregateError(failures, "Storage probe or cleanup failed");
  if ("error" in result) throw result.error;
  return result.value;
};
