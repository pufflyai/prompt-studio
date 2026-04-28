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
  test("static ticket command tree only owns the namespace shell", () => {
    const sources = ticketCommandSources();

    expect(sources.map(({ fileName }) => fileName).sort()).toEqual(["index.ts"]);

    for (const { fileName, source } of sources) {
      expect(source, fileName).not.toContain("pstdio-ext-planner");
    }
  });
});
