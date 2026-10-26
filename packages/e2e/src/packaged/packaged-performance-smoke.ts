import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createPerformanceRecording } from "pstdio-diagnostics";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";

export const registerPerformanceSmokeTests = () => {
  test("the packaged observer reads native CPU and memory without starting a runtime", async () => {
    const observer = Bun.spawn([PACKAGED_BINARY_PATH, "performance-observer"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    const lines = createInterface({ input: Readable.from(observer.stdout) });
    const iterator = lines[Symbol.asyncIterator]();
    try {
      observer.stdin.write(`${observer.pid}\n`);
      await observer.stdin.flush();
      const line = await iterator.next();
      expect(line.done).toBe(false);
      const reading = JSON.parse(line.value!);
      expect(reading.processStartId).toBeString();
      expect(Date.parse(reading.startedAt)).toBeGreaterThan(0);
      expect(Date.parse(reading.startedAt)).toBeLessThanOrEqual(Date.now());
      expect(reading.cpuTimeMs).toBeGreaterThanOrEqual(0);
      expect(reading.residentBytes).toBeGreaterThan(0);
      if (process.platform === "darwin") {
        expect(reading.physicalFootprintBytes).toBeGreaterThan(0);
        expect(reading.peakPhysicalFootprintBytes).toBeGreaterThanOrEqual(reading.physicalFootprintBytes);
      }
      if (process.platform === "win32") expect(reading.privateCommittedBytes).toBeGreaterThan(0);
      if (process.platform === "linux") expect(reading.peakResidentBytes).toBeGreaterThan(0);
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

export const expectPackagedSavedRecordings = async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-offline-performance-"));
  try {
    const directory = join(home, "saved");
    const writer = createPerformanceRecording(directory);
    writer.write({ kind: "sample", captureId: "saved", sample: { sequence: 0 } });
    writer.close();
    const child = Bun.spawn([PACKAGED_BINARY_PATH, "performance", "recordings", directory], {
      env: { ...process.env, PSTDIO_HOME: home },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, status] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(stderr).toBe("");
    expect(status).toBe(0);
    const exported = JSON.parse(stdout);
    expect(exported.directory).toBe(directory);
    expect(exported.files).toHaveLength(1);
    expect(JSON.parse(exported.files[0].content)).toMatchObject({ captureId: "saved", sample: { sequence: 0 } });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
};
