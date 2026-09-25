import { createHash } from "node:crypto";
import { closeSync, createReadStream, mkdtempSync, openSync, rmSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "desktop-checksum-"));
const path = join(root, "runtime.bin");
const fd = openSync(path, "w");
const block = Buffer.alloc(1024 * 1024, 42);
for (let index = 0; index < 400; index++) writeSync(fd, block);
closeSync(fd);
try {
  for (const highWaterMark of [64 * 1024, 1024 * 1024, 4 * 1024 * 1024, 64 * 1024, 1024 * 1024]) {
    const hash = createHash("sha256");
    const started = performance.now();
    for await (const chunk of createReadStream(path, { highWaterMark })) hash.update(chunk);
    console.log(
      JSON.stringify({ highWaterMark, durationMs: performance.now() - started, checksum: hash.digest("hex") }),
    );
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
