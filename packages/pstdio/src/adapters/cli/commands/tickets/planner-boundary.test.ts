import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const commandDir = import.meta.dirname;

const ticketCommandSources = () =>
  readdirSync(commandDir)
    .filter((fileName) => fileName.endsWith(".ts") && !fileName.endsWith(".test.ts"))
    .map((fileName) => ({
      fileName,
      source: readFileSync(join(commandDir, fileName), "utf8"),
    }));

describe("tickets planner boundary", () => {
  test("ticket commands do not import planner implementations directly", () => {
    for (const { fileName, source } of ticketCommandSources()) {
      expect(source, fileName).not.toContain("pstdio-ext-planner");
    }
  });
});
