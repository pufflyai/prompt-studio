import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDashboardRoot } from "./resolve-dashboard-root";

test("finds dashboard dist in workspace", () => {
  const base = mkdtempSync(join(tmpdir(), "dash-ws-"));
  const dashDist = join(base, "packages", "pstdio-dashboard", "dist");
  mkdirSync(dashDist, { recursive: true });
  writeFileSync(join(dashDist, "index.html"), "<html></html>");

  const startDir = join(base, "packages", "pstdio", "src");
  mkdirSync(startDir, { recursive: true });

  expect(resolveDashboardRoot(startDir)).toBe(dashDist);
});

test("finds bundled dashboard dist relative to CLI entry", () => {
  const base = mkdtempSync(join(tmpdir(), "dash-bundled-"));
  const cliDist = join(base, "dist");
  const dashDir = join(cliDist, "dashboard");
  mkdirSync(dashDir, { recursive: true });
  writeFileSync(join(dashDir, "index.html"), "<html></html>");

  const startDir = join(base, "no-workspace");
  mkdirSync(startDir, { recursive: true });

  expect(resolveDashboardRoot(startDir, join(cliDist, "index.js"))).toBe(dashDir);
});

test("throws when dashboard not found", () => {
  const base = mkdtempSync(join(tmpdir(), "dash-none-"));
  const startDir = join(base, "empty");
  mkdirSync(startDir, { recursive: true });

  expect(() => resolveDashboardRoot(startDir, join(base, "dist", "index.js"))).toThrow("Dashboard build not found");
});
