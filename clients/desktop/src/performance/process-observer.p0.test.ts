import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { createProcessObserver } from "./process-observer";

test("reads real process metrics over the private pipe and closes it on disable", async () => {
  const source = fileURLToPath(new URL("../../../../packages/pstdio/src/index.ts", import.meta.url));
  const observer = createProcessObserver({
    executable: process.execPath,
    args: ["--conditions=source", source, "performance-observer"],
  });
  try {
    for (let sample = 0; sample < 3; sample++) {
      const reading = await observer.read(process.pid, new AbortController().signal);
      expect(reading?.residentBytes).toBeGreaterThan(0);
      expect(reading?.processStartId).toBeTruthy();
    }
  } finally {
    await observer.close();
  }
  await expect(observer.read(process.pid, new AbortController().signal)).rejects.toThrow();
});
