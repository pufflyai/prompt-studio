import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
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
      observer.stdin.write(`${process.pid}\n`);
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

export const expectPackagedSavedRecordings = async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-offline-performance-"));
  try {
    const directory = join(home, "saved");
    const writer = await createPerformanceRecording(directory);
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

export const expectPackagedRenderCapture = async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-render-capture-"));
  const token = "a".repeat(64);
  const renderCapture = {
    status: "complete",
    startedAt: "2026-11-17T12:00:00.000Z",
    endedAt: "2026-11-17T12:00:10.000Z",
    components: [{ name: "SidebarRow", renders: 3, unchanged: 2, unknown: 0, renderMs: 10, unchangedRenderMs: 8 }],
    unnamedRenders: 0,
    truncated: false,
  };
  const server = createServer((socket) => {
    const lines = createInterface({ input: socket });
    lines.once("line", (credential) => {
      lines.close();
      if (credential !== `${token} renders`) {
        socket.destroy();
        return;
      }
      socket.end(`${JSON.stringify({ capture: renderCapture })}\n`);
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing local endpoint");
    const endpoint = join(home, "performance");
    mkdirSync(endpoint);
    writeFileSync(join(endpoint, "endpoint.json"), JSON.stringify({ port: address.port, token }));
    const child = Bun.spawn([PACKAGED_BINARY_PATH, "performance", "renders"], {
      env: { ...process.env, PSTDIO_HOME: home },
      stdout: "pipe",
    });
    const [stdout, status] = await Promise.all([new Response(child.stdout).text(), child.exited]);
    expect(status).toBe(0);
    expect(JSON.parse(stdout)).toEqual(renderCapture);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(home, { recursive: true, force: true });
  }
};
