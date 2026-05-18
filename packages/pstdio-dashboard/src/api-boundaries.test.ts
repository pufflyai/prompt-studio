import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const dashboardRoot = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(dashboardRoot, "src");

const getProductionFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return getProductionFiles(path);
    }

    if (!/\.(ts|tsx)$/.test(entry) || /\.(test|stories)\.(ts|tsx)$/.test(entry)) {
      return [];
    }

    return [path];
  });

describe("dashboard api boundaries", () => {
  test("production source does not import backend DTO internals", () => {
    const offenders = getProductionFiles(srcRoot)
      .filter((file) => readFileSync(file, "utf8").includes("pstdio-api/dto"))
      .map((file) => relative(dashboardRoot, file));

    expect(offenders).toEqual([]);
  });

  test("dashboard does not declare the backend api package", () => {
    const packageJson = JSON.parse(readFileSync(join(dashboardRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.["pstdio-api"]).toBeUndefined();
    expect(packageJson.devDependencies?.["pstdio-api"]).toBeUndefined();
  });

  test("dashboard depends on the public sdk instead of api contracts", () => {
    const packageJson = JSON.parse(readFileSync(join(dashboardRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.["@pstdio/sdk"]).toBe("workspace:*");
    expect(packageJson.dependencies?.["pstdio-api-contracts"]).toBeUndefined();
    expect(packageJson.devDependencies?.["pstdio-api-contracts"]).toBeUndefined();
  });

  test("production source imports api contract types through the sdk", () => {
    const offenders = getProductionFiles(srcRoot)
      .filter((file) => readFileSync(file, "utf8").includes("pstdio-api-contracts"))
      .map((file) => relative(dashboardRoot, file));

    expect(offenders).toEqual([]);
  });

  test("production source routes api fetches through the sdk request wrapper", () => {
    const offenders = getProductionFiles(srcRoot)
      .map((file) => relative(dashboardRoot, file))
      .filter((file) => /\bfetch\s*\(/.test(readFileSync(join(dashboardRoot, file), "utf8")));

    expect(offenders).toEqual([]);
  });

  test("production source opens api event streams through the sdk", () => {
    const offenders = getProductionFiles(srcRoot)
      .filter((file) => /\bnew\s+EventSource\s*\(/.test(readFileSync(file, "utf8")))
      .map((file) => relative(dashboardRoot, file));

    expect(offenders).toEqual([]);
  });
});
