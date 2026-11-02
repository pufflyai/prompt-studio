import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gte, lt } from "semver";

export const verifyWindowsUpdateData = (input: {
  home: string;
  baselineVersion: string;
  candidateVersion: string;
  project: { id: string; name: string };
  projects: { id: string; name: string }[];
}) => {
  // ADR 0103 retires pre-0.46 databases. Later updates must keep their active projects.
  if (!lt(input.baselineVersion, "0.46.0-0") || !gte(input.candidateVersion, "0.46.0-0")) {
    assert(
      input.projects.some((project) => project.id === input.project.id && project.name === input.project.name),
      "An update within the database baseline must preserve the installed project",
    );
    return;
  }
  assert.deepEqual(input.projects, [], "The 0.46 database baseline must start empty");
  const marker = JSON.parse(readFileSync(join(input.home, "pstdio.db", ".pstdio-engine.json"), "utf8"));
  assert.equal(marker.baseline, "0.46");
  const backups = join(input.home, "backups");
  const retired = readdirSync(backups, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && entry.name.startsWith("pre-0.46-") && entry.name.endsWith("-pstdio.db"),
  );
  assert.equal(retired.length, 1, "The installed baseline must have one retired database");
  const backup = join(backups, retired[0]!.name);
  const database = join(backup, "database");
  const projectsExport = join(backup, "export", "tables", "public.projects.jsonl");
  assert(existsSync(join(database, "PG_VERSION")), "The raw database must remain available");
  assert(!existsSync(join(backup, "export-error.txt")), "The installed fixture must export successfully");
  assert(!existsSync(join(backup, "export", "errors.txt")), "The installed fixture export must be complete");
  const projects = readFileSync(projectsExport, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { id: string; name: string });
  assert(
    projects.some((project) => project.id === input.project.id && project.name === input.project.name),
    "The original installed project must remain in the JSON export",
  );
  return { database, projectsExport };
};
