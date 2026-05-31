import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const sourceRoot = join(import.meta.dirname);
const skippedDirs = new Set(["dist", "node_modules"]);
const skippedExtensions = new Set([".json"]);
const forbiddenCoreTicketReferences = [
  "/v1/tickets",
  "ticket-statuses",
  "ticket-tags",
  '"tickets"',
  '"ticket_statuses"',
  '"ticket_tags"',
  '"ticket_tag_options"',
  '"ticket_tag_assignments"',
  '"ticket_workspaces"',
  '"ticket_files"',
] as const;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return skippedDirs.has(entry) ? [] : sourceFiles(path);
    if (skippedExtensions.has(path.slice(path.lastIndexOf(".")))) return [];
    return [path];
  });

describe("dashboard workbench ticket ownership boundary", () => {
  test("does not read deprecated core ticket API or synced ticket tables", () => {
    const offenders = sourceFiles(sourceRoot).flatMap((file) => {
      if (file.endsWith("dashboard-workbench-ticket-boundary.test.ts")) return [];

      const contents = readFileSync(file, "utf8");
      return forbiddenCoreTicketReferences
        .filter((reference) => contents.includes(reference))
        .map((reference) => `${relative(sourceRoot, file)} contains ${reference}`);
    });

    expect(offenders).toEqual([]);
  });
});
