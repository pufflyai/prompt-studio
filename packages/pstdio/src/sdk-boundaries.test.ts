import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const featureApiRoot = join(packageRoot, "src", "features");

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
      .map((file) => relative(packageRoot, file));

    expect(offenders).toEqual([]);
  });

  test("cli feature api adapters use the sdk client instead of direct fetch", () => {
    const offenders = getProductionFiles(featureApiRoot)
      .filter((file) => relative(featureApiRoot, file).split("/").includes("api"))
      .filter((file) => readFileSync(file, "utf8").includes("fetch("))
      .map((file) => relative(packageRoot, file));

    expect(offenders).toEqual([]);
  });

  test("cli app-facing source uses sdk transports instead of raw fetch", () => {
    const rawFetchAllowed = new Set(["src/adapters/cli/commands/serve/serve-app.ts"]);
    const offenders = getProductionFiles(packageRoot)
      .map((file) => relative(packageRoot, file))
      .filter((file) => !rawFetchAllowed.has(file))
      .filter((file) => /\bfetch\s*\(/.test(readFileSync(join(packageRoot, file), "utf8")));

    expect(offenders).toEqual([]);
  });
});
