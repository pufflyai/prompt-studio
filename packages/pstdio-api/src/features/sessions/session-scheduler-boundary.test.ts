import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const sessionsFeatureRoot = fileURLToPath(new URL(".", import.meta.url));
const apiSrcRoot = fileURLToPath(new URL("../../", import.meta.url));

const getProductionFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return getProductionFiles(path);
    }

    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts") || entry === "session-scheduler.ts") {
      return [];
    }

    return [path];
  });

describe("session scheduler boundary", () => {
  test("production session routes do not dispatch provider sessions directly", () => {
    const offenders = getProductionFiles(join(sessionsFeatureRoot, "endpoints"))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return /spawnAgentSession|resumeAgentSession|sessionService\.resume\(/.test(source);
      })
      .map((file) => relative(apiSrcRoot, file));

    expect(offenders).toEqual([]);
  });
});
