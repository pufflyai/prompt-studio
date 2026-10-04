import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PerformanceMonitoringPreference } from "./performance-preference";

const roots: string[] = [];
const preferencePath = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-desktop-performance-"));
  roots.push(root);
  return join(root, "performance-monitoring.json");
};

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

describe("performance monitoring preference", () => {
  test("is off until this device turns it on, and survives a restart", () => {
    const path = preferencePath();
    const first = new PerformanceMonitoringPreference(path);
    expect(first.enabled).toBe(false);

    first.set(true);
    expect(new PerformanceMonitoringPreference(path).enabled).toBe(true);

    first.set(false);
    expect(new PerformanceMonitoringPreference(path).enabled).toBe(false);
  });

  test("treats an unreadable file as off", () => {
    const path = preferencePath();
    writeFileSync(path, "{not json", "utf8");
    expect(new PerformanceMonitoringPreference(path).enabled).toBe(false);
    writeFileSync(path, '{"enabled":"yes"}', "utf8");
    expect(new PerformanceMonitoringPreference(path).enabled).toBe(false);
  });
});
