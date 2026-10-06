import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// The core database must not own extension data. Only migrations of released formats
// and the deprecated anchor bridge may name their old owners. Removal rules live in
// documentation/references/architecture/0025-database-upgrades.md.
const LEGACY_FILES = new Set([
  "drizzle/0020_harness_id_namespacing.sql",
  "drizzle/0029_contribution_id_grammar.sql",
  "src/db/contribution-id-renames.ts",
  "src/db/legacy-template-owners.ts",
  "drizzle/0036_superb_diamondback.sql",
  "src/services/legacy-resource-links.ts",
]);

// First-party extension ids: `pstdio.pstdio-<name>` and `pstdio.harness-<name>`.
const extensionId = /\bpstdio\.(?:pstdio|harness)-[a-z0-9-]+/;

const packageRoot = path.resolve(import.meta.dir, "../..");

const filesUnder = (dir: string): string[] =>
  readdirSync(path.join(packageRoot, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "meta" ? [] : filesUnder(file);
    return /\.(sql|ts)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [file] : [];
  });

describe("pstdio-db extension ownership", () => {
  test("new migrations and database code name no extension ids", () => {
    const offenders = [...filesUnder("src"), ...filesUnder("drizzle")].filter(
      (file) => !LEGACY_FILES.has(file) && extensionId.test(readFileSync(path.join(packageRoot, file), "utf8")),
    );

    expect(offenders).toEqual([]);
  });
});
