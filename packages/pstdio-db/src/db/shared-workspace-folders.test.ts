import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createWorkspacesDBService } from "../services/workspaces/workspaces";
import { createDb } from "./connection.pglite";
import { migrateThrough } from "./migrate-through";
import * as schema from "./schemas.pg";

type LegacyWorkspace = [id: string, project: string, path: string | null, isDefault: boolean, createdAt: string];

const seedProjects = async (seed: Transaction, ids: string[]) => {
  for (const id of ids)
    await seed.query(
      "INSERT INTO projects(id,name,shorthand,created_at,updated_at) VALUES ($1,$1,$1,'2026-01-01','2026-01-01')",
      [id],
    );
};
const seedWorkspaces = async (seed: Transaction, rows: readonly LegacyWorkspace[]) => {
  for (const [id, project, path, isDefault, createdAt] of rows)
    await seed.query(
      "INSERT INTO workspaces(id,project_id,name,workspace_shorthand,root_path,is_default,created_at,updated_at) VALUES ($1,$2,$1,$1,$3,$4,$5,$5)",
      [id, project, path, isDefault, createdAt],
    );
};

// Builds a database at the last migration before the folder index, then opens it with the current host.
const upgradeFrom = async (seed: (tx: Transaction) => Promise<void>) => {
  const root = await mkdtemp(join(tmpdir(), "shared-workspace-folders-"));
  const old = new PGlite();
  await old.waitReady;
  let image: Blob;
  try {
    await migrateThrough(drizzle(old, { schema }), join(import.meta.dir, "../../drizzle"), 32);
    await old.transaction(seed);
    image = await old.dumpDataDir("none");
  } finally {
    await old.close();
  }
  await new Bun.Archive(image).extract(join(root, "database"));
  const upgraded = await createDb({ path: join(root, "database") });
  const close = async () => {
    await upgraded.close();
    await rm(root, { recursive: true, force: true });
  };
  return { db: upgraded.db, workspaces: createWorkspacesDBService(upgraded.db), close };
};
const activeWorkspaceIds = async (db: Awaited<ReturnType<typeof upgradeFrom>>["db"]) =>
  (await db.select().from(schema.workspaces))
    .filter((row) => !row.deleted_at)
    .map((row) => row.id)
    .sort();

test("upgrading keeps one workspace per folder and rejects new ones in a used folder", async () => {
  const upgraded = await upgradeFrom(async (seed) => {
    await seedProjects(seed, ["home", "first", "second", "live", "gone"]);
    await seedWorkspaces(seed, [
      ["home-default", "home", "/home", true, "2026-01-01"],
      ["home-extra", "home", "/home", false, "2026-02-01"],
      ["first-worktree", "first", "/workspaces/WS-1", false, "2026-01-01"],
      ["second-worktree", "second", "/workspaces/WS-1", false, "2026-02-01"],
      ["first-remote", "first", null, false, "2026-01-01"],
      ["second-remote", "second", null, false, "2026-01-01"],
      ["live-default", "live", "/reused", true, "2026-01-01"],
      ["gone-default", "gone", "/reused", true, "2026-02-01"],
    ]);
    await seed.query("UPDATE projects SET deleted_at = '2026-03-01' WHERE id = 'gone'");
    await seed.query(
      "INSERT INTO sessions(id,project_id,title,created_at,updated_at) VALUES ('session','home','History','2026-01-01','2026-01-01')",
    );
    await seed.query(
      "INSERT INTO workspace_sessions(id,workspace_id,session_id,created_at) VALUES ('link','home-extra','session','2026-01-01')",
    );
  });
  try {
    expect(await activeWorkspaceIds(upgraded.db)).toEqual([
      "first-remote",
      "home-default",
      "live-default",
      "second-remote",
      "second-worktree",
    ]);
    expect(await upgraded.db.select().from(schema.workspace_sessions)).toMatchObject([
      { workspace_id: "home-extra", session_id: "session" },
    ]);
    await expect(upgraded.workspaces.createStandalone({ project_id: "home", root_path: "/home" })).rejects.toThrow();
  } finally {
    await upgraded.close();
  }
});

test("upgrading frees the folders of deleted projects so they can be opened again", async () => {
  const upgraded = await upgradeFrom(async (seed) => {
    await seedProjects(seed, ["gone", "fresh"]);
    await seedWorkspaces(seed, [["gone-default", "gone", "/abandoned", true, "2026-01-01"]]);
    await seed.query("UPDATE projects SET deleted_at = '2026-03-01' WHERE id = 'gone'");
  });
  try {
    expect(await activeWorkspaceIds(upgraded.db)).toEqual([]);
    await upgraded.workspaces.createDefault({ project_id: "fresh", root_path: "/abandoned", name: "Project folder" });
  } finally {
    await upgraded.close();
  }
});

test("upgrading keeps the newest project of a shared home folder and removes the others", async () => {
  const upgraded = await upgradeFrom(async (seed) => {
    await seedProjects(seed, ["older", "newer"]);
    await seedWorkspaces(seed, [
      ["older-default", "older", "/shared", true, "2026-01-01"],
      ["older-worktree", "older", "/workspaces/older", false, "2026-01-01"],
      ["newer-default", "newer", "/shared", true, "2026-02-01"],
    ]);
  });
  try {
    const live = (await upgraded.db.select().from(schema.projects)).filter((project) => !project.deleted_at);
    expect(live.map((project) => project.id)).toEqual(["newer"]);
    expect(await activeWorkspaceIds(upgraded.db)).toEqual(["newer-default"]);
  } finally {
    await upgraded.close();
  }
});

test("upgrading keeps an active workspace over a newer archived one in the same folder", async () => {
  const upgraded = await upgradeFrom(async (seed) => {
    await seedProjects(seed, ["first", "second"]);
    await seedWorkspaces(seed, [
      ["first-worktree", "first", "/workspaces/WS-1", false, "2026-01-01"],
      ["second-worktree", "second", "/workspaces/WS-1", false, "2026-02-01"],
    ]);
    await seed.query("UPDATE workspaces SET archived = true WHERE id = 'second-worktree'");
  });
  try {
    expect(await activeWorkspaceIds(upgraded.db)).toEqual(["first-worktree"]);
  } finally {
    await upgraded.close();
  }
});
