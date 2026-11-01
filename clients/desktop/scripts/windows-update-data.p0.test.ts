import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyWindowsUpdateData } from "./windows-update-data";

const homes: string[] = [];
const project = { id: "original-project", name: "Windows installed project" };
const fixture = () => {
  const home = mkdtempSync(join(tmpdir(), "windows-update-data-"));
  homes.push(home);
  const backup = join(home, "backups", "pre-0.46-2026-11-01T00-00-00.000Z-pstdio.db");
  const database = join(backup, "database");
  const projectsExport = join(backup, "export", "tables", "public.projects.jsonl");
  mkdirSync(database, { recursive: true });
  mkdirSync(join(backup, "export", "tables"), { recursive: true });
  mkdirSync(join(home, "pstdio.db"));
  writeFileSync(join(database, "PG_VERSION"), "17\n");
  writeFileSync(projectsExport, `${JSON.stringify(project)}\n`);
  writeFileSync(join(home, "pstdio.db", ".pstdio-engine.json"), JSON.stringify({ baseline: "0.46" }));
  return { home, database, projectsExport };
};

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

test("updates within the database baseline keep the installed project active", () => {
  const { home } = fixture();
  expect(
    verifyWindowsUpdateData({
      home,
      baselineVersion: "0.46.0",
      candidateVersion: "0.46.1",
      project,
      projects: [project],
    }),
  ).toBeUndefined();
});

test.each([
  "0.46.0",
  "0.46.0-nightly.20261101000000",
])("updating 0.45 to %s retains the old database and exported project beside the fresh baseline", (candidateVersion) => {
  const { home, database, projectsExport } = fixture();
  expect(verifyWindowsUpdateData({ home, baselineVersion: "0.45.0", candidateVersion, project, projects: [] })).toEqual(
    { database, projectsExport },
  );
});

test("an update within the same baseline rejects a missing installed project", () => {
  const { home } = fixture();
  expect(() =>
    verifyWindowsUpdateData({ home, baselineVersion: "0.46.0", candidateVersion: "0.46.1", project, projects: [] }),
  ).toThrow();
});

test("a baseline transition rejects a missing raw database", () => {
  const { home, database } = fixture();
  rmSync(database, { recursive: true });
  expect(() =>
    verifyWindowsUpdateData({ home, baselineVersion: "0.45.0", candidateVersion: "0.46.0", project, projects: [] }),
  ).toThrow();
});

test("a baseline transition rejects an export without the original project", () => {
  const { home, projectsExport } = fixture();
  writeFileSync(projectsExport, `${JSON.stringify({ ...project, id: "another-project" })}\n`);
  expect(() =>
    verifyWindowsUpdateData({ home, baselineVersion: "0.45.0", candidateVersion: "0.46.0", project, projects: [] }),
  ).toThrow();
});
