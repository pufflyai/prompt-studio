import { expect, test } from "bun:test";
import { createInterface } from "node:readline";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";

export const registerPerformanceSmokeTests = () => {
  test("the packaged observer reads native CPU and memory without starting a runtime", async () => {
    const observer = Bun.spawn([PACKAGED_BINARY_PATH, "performance-observer"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    const lines = createInterface({ input: (await import("node:stream")).Readable.fromWeb(observer.stdout) });
    const iterator = lines[Symbol.asyncIterator]();
    try {
      observer.stdin.write(`${process.pid}\n`);
      await observer.stdin.flush();
      const line = await iterator.next();
      expect(line.done).toBe(false);
      const reading = JSON.parse(line.value!);
      expect(reading.processStartId).toBeString();
      expect(reading.cpuTimeMs).toBeGreaterThanOrEqual(0);
      expect(reading.residentBytes).toBeGreaterThan(0);
      if (process.platform === "darwin") {
        expect(reading.physicalFootprintBytes).toBeGreaterThan(0);
        expect(reading.peakPhysicalFootprintBytes).toBeGreaterThanOrEqual(reading.physicalFootprintBytes);
      }
      if (process.platform === "win32") expect(reading.privateCommittedBytes).toBeGreaterThan(0);
      if (process.platform === "linux") expect(reading.peakResidentBytes).toBeGreaterThan(0);
      const before = process.cpuUsage();
      while (process.cpuUsage(before).user < 250_000) {
        // Enough CPU work to tolerate coarse native counters without depending on scheduling.
      }
      observer.stdin.write(`${process.pid}\n`);
      await observer.stdin.flush();
      const next = JSON.parse((await iterator.next()).value!);
      const used = process.cpuUsage(before);
      const expectedMs = (used.user + used.system) / 1000;
      const measuredMs = next.cpuTimeMs - reading.cpuTimeMs;
      expect(measuredMs).toBeGreaterThan(expectedMs * 0.8);
      expect(measuredMs).toBeLessThan(expectedMs * 1.2);
      observer.stdin.write("2147483647\n");
      await observer.stdin.flush();
      expect(JSON.parse((await iterator.next()).value!)).toBeNull();
      observer.stdin.end();
      expect(await observer.exited).toBe(0);
    } finally {
      lines.close();
      observer.kill();
      await observer.exited;
    }
  });
};
