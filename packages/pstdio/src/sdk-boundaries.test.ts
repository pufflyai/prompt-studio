import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

// Compare against "/"-separated paths on every platform.
const rel = (from: string, to: string) => relative(from, to).replaceAll("\\", "/");

const getProductionFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    if (entry === "node_modules" || entry === "dist") {
      return [];
    }

    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return getProductionFiles(path);
    }

    if (!/\.ts$/.test(entry) || /\.test\.ts$/.test(entry)) {
      return [];
    }

    return [path];
  });

describe("sdk boundaries", () => {
  test("cli production source imports API contract types through the sdk", () => {
    const offenders = getProductionFiles(packageRoot)
      .filter((file) => readFileSync(file, "utf8").includes("pstdio-api-contracts"))
      .map((file) => rel(packageRoot, file));

    expect(offenders).toEqual([]);
  });

  test("cli app-facing source uses sdk transports instead of raw fetch", () => {
    const rawFetchAllowed = new Set(["src/adapters/cli/commands/serve/serve-app.ts"]);
    const offenders = getProductionFiles(packageRoot)
      .map((file) => rel(packageRoot, file))
      .filter((file) => !rawFetchAllowed.has(file))
      .filter((file) => /\bfetch\s*\(/.test(readFileSync(join(packageRoot, file), "utf8")));

    expect(offenders).toEqual([]);
  });
});
