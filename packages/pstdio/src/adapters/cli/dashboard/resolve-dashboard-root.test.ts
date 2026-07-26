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

test("finds dashboard dist relative to source CLI entry when cwd is outside the repo", () => {
  const base = mkdtempSync(join(tmpdir(), "dash-source-cli-"));
  const outsideBase = mkdtempSync(join(tmpdir(), "dash-source-cli-outside-"));
  const dashDist = join(base, "packages", "pstdio-dashboard", "dist");
  const cliEntry = join(base, "packages", "pstdio", "src", "index.ts");
  const startDir = join(outsideBase, "cwd");

  mkdirSync(dashDist, { recursive: true });
  mkdirSync(join(base, "packages", "pstdio", "src"), { recursive: true });
  mkdirSync(startDir, { recursive: true });
  writeFileSync(join(dashDist, "index.html"), "<html></html>");
  writeFileSync(cliEntry, "// cli entry");

  expect(resolveDashboardRoot(startDir, cliEntry)).toBe(dashDist);
});

// The message ships inside the published CLI, so it has to make sense outside this repo.
test("throws with an instruction an installed user can act on", () => {
  const base = mkdtempSync(join(tmpdir(), "dash-none-"));
  const startDir = join(base, "empty");
  mkdirSync(startDir, { recursive: true });

  expect(() => resolveDashboardRoot(startDir, join(base, "dist", "index.js"))).toThrow("Dashboard assets not found");
  expect(() => resolveDashboardRoot(startDir, join(base, "dist", "index.js"))).toThrow("Reinstall pstdio");
});
