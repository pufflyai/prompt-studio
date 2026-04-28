import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const API_SRC = join(import.meta.dir);

const walkTsFiles = (dir: string, files: string[] = []) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walkTsFiles(path, files);
      continue;
    }

    if (path.endsWith(".ts")) files.push(path);
  }

  return files;
};

describe("pstdio-api planner boundary", () => {
  test("does not import the planner extension package directly", () => {
    const offenders = walkTsFiles(API_SRC)
      .filter((path) => !path.endsWith(".test.ts"))
      .filter((path) => readFileSync(path, "utf8").includes("@pstdio/pstdio-ext-planner"));

    expect(offenders).toEqual([]);
  });

  test("does not register ticket-specific API route layers", () => {
    const source = readFileSync(join(API_SRC, "app.ts"), "utf8");

    expect(source).not.toContain("createPlannerRoutes");
    expect(source).not.toContain("createTicketRoutes");
    expect(source).not.toContain("createStatusRoutes");
    expect(source).not.toContain("createTagRoutes");
  });
});
