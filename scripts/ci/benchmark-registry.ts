import { readFileSync } from "node:fs";

// Scope runs before dependency installation. Resolve the workspace's public entry directly.
const manifestPath = new URL("../../packages/benchmarks/package.json", import.meta.url);
const benchmarkManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
export const { suites } = (await import(
  new URL(benchmarkManifest.exports["."], manifestPath).href
)) as typeof import("pstdio-benchmarks");
