import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFiles } from "./files";

test("fixture files resume at their stored extent and verify every received byte", async () => {
  const directory = await mkdtemp(join(tmpdir(), "relay-measurement-files-"));
  const files = await createFiles(directory);
  const bytes = new Uint8Array(200_000).map((_, index) => index % 251);
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "application/octet-stream",
  };
  try {
    await Bun.write(join(directory, asset.sha256), bytes.subarray(0, 100));
    let resumedAt = -1;
    await files.store.receive(asset, async (offset) => {
      resumedAt = offset;
      return new ReadableStream({
        start(controller) {
          controller.enqueue(bytes.subarray(offset, 50_000));
          controller.enqueue(bytes.subarray(50_000));
          controller.close();
        },
      });
    });
    expect(resumedAt).toBe(100);
    await files.store.verifyComplete([asset]);
    expect(new Uint8Array(await new Response(await files.store.read(asset)).arrayBuffer())).toEqual(bytes);
    const invalid = { ...asset, sha256: "f".repeat(64) };
    await expect(files.store.receive(invalid, async () => new Blob([bytes]).stream())).rejects.toThrow();
    await expect(files.store.verifyComplete([invalid])).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
