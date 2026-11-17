import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashRevisionInputs, hashRevisionInputsAsync, type RevisionHashInput } from "./revision-file-hash";

test("async revision hashing preserves byte order across cached, prefetched and large files", async () => {
  const root = mkdtempSync(join(tmpdir(), "revision-hash-order-"));
  const inputs: RevisionHashInput[] = [{ value: "header\0" }];
  const expected = createHash("sha256").update("header\0");
  const contents = new Map<string, Buffer>();
  try {
    for (let index = 0; index < 13; index++) {
      const file = join(root, `${index}.bin`);
      const bytes = Buffer.alloc(index === 4 ? 9 * 1024 * 1024 + 17 : index * 31 + 1, index);
      writeFileSync(file, bytes);
      if (index === 2) contents.set(file, bytes);
      inputs.push({ file }, { value: `end-${index}\0` });
      expected.update(bytes).update(`end-${index}\0`);
    }
    const digest = expected.digest("hex");
    expect(hashRevisionInputs(inputs, contents)).toBe(digest);
    expect(await hashRevisionInputsAsync(inputs, contents)).toBe(digest);
    writeFileSync(join(root, "12.bin"), "changed dependency bytes");
    expect(await hashRevisionInputsAsync(inputs, new Map())).not.toBe(digest);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failed dependency read rejects after the other bounded reads settle", async () => {
  const root = mkdtempSync(join(tmpdir(), "revision-hash-error-"));
  const file = join(root, "present.bin");
  writeFileSync(file, "present");
  try {
    await expect(
      hashRevisionInputsAsync(
        [{ file: join(root, "missing.bin") }, ...Array.from({ length: 12 }, () => ({ file }))],
        new Map(),
      ),
    ).rejects.toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
