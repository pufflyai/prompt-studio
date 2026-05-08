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
});
