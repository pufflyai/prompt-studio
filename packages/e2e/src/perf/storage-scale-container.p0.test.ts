import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configuredContainer, parseContainerProcess } from "./storage-scale-container";

test("an explicit container boundary cannot silently fall back to a different native fixture", () => {
  const root = mkdtempSync(join(tmpdir(), "scale-container-"));
  const previous = process.env.PSTDIO_SCALE_CONTAINER_CONFIG;
  try {
    const path = join(root, "runtime.json");
    const home = join(root, "home");
    writeFileSync(path, JSON.stringify({ home, containerId: "diagnostic", baseUrl: "http://127.0.0.1:19841" }));
    process.env.PSTDIO_SCALE_CONTAINER_CONFIG = path;
    expect(configuredContainer(home)?.containerId).toBe("diagnostic");
    expect(() => configuredContainer(join(root, "other"))).toThrow("fixture home differ");
  } finally {
    if (previous === undefined) delete process.env.PSTDIO_SCALE_CONTAINER_CONFIG;
    else process.env.PSTDIO_SCALE_CONTAINER_CONFIG = previous;
    rmSync(root, { recursive: true });
  }
});

test("reads the runtime's CPU and memory from inside the container, not from a host process", () => {
  const stat = "7 (bun (runtime)) S 1 7 7 0 -1 4194560 2000 0 0 0 250 50 0 0 20 0 12 0 4321 900000000 30000";
  const status = "Name:\tbun\nVmHWM:\t  204800 kB\nVmRSS:\t  102400 kB\n";

  expect(parseContainerProcess(`100\n${stat}\n${status}`)).toEqual({
    processStartId: "4321",
    cpuTimeMs: 3000,
    residentBytes: 102_400 * 1024,
    peakResidentBytes: 204_800 * 1024,
    physicalFootprintBytes: null,
    peakPhysicalFootprintBytes: null,
    privateCommittedBytes: null,
  });
  // A process that has exited or become a zombie has no reading, never a zero.
  expect(parseContainerProcess(`100\n${stat.replace(" S ", " Z ")}\n${status}`)).toBeNull();
  expect(parseContainerProcess("")).toBeNull();
});
