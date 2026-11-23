import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

test("upgrade capture preserves Unicode, oversized rows, final tails and empty markers while interrupted capture stays private", async () => {
  const root = await mkdtemp(join(tmpdir(), "upgrade-snapshot-"));
  const f = await createTextLogOwnerFixture(root);
  try {
    for (const [id, name] of [
      ["a", "a".repeat(40_000)],
      ["b", "b".repeat(40_000)],
      ["c", "日本語".repeat(12_000)],
      ["z", "final\nrow"],
    ])
      await f.pglite.query(
        "INSERT INTO projects(id,name,shorthand,created_at,updated_at) VALUES($1,$2,$1,'2026-11-22','2026-11-22')",
        [id, name],
      );
    const read = async () => (await f.pglite.query<Record<string, unknown>>("SELECT * FROM projects ORDER BY id")).rows;
    const original = await read();
    const expected = original.map((row) => ({ ...row, tag: "日本語\n\0\ud800" }));
    const bytes = expected.map((row) => `${JSON.stringify(row)}\n`).join("");
    const source = { table: "projects", keys: ["id"], name: "capture", archive: "capture" };
    const restored: Record<string, unknown>[] = [];
    const resume = await prepareUpgradeSnapshot(
      f.db,
      f.path,
      source,
      async (row) => {
        restored.push(row);
      },
      async (row) => ({ ...row, tag: "日本語\n\0\ud800" }),
    );
    const snapshot = `${f.path}-capture-upgrade.jsonl`;
    expect(await readFile(snapshot, "utf8")).toBe(bytes);
    if (process.platform !== "win32") expect((await stat(snapshot)).mode & 0o777).toBe(0o600);
    await resume!(true);
    expect(restored).toEqual(expected);
    expect(await Bun.file(snapshot).exists()).toBe(true);
    await resume!.complete();
    expect(await readFile(`${f.path}-migration-exports/capture.jsonl`, "utf8")).toBe(bytes);
    expect(await Bun.file(snapshot).exists()).toBe(false);

    const interrupted = `${f.path}-interrupted-upgrade.jsonl`;
    await expect(
      prepareUpgradeSnapshot(
        f.db,
        f.path,
        { ...source, name: "interrupted" },
        async () => {},
        async (row) => {
          if (row.id === "z") {
            expect(await Bun.file(`${interrupted}.tmp`).exists()).toBe(true);
            throw new Error("capture interrupted after a written prefix");
          }
          return row;
        },
      ),
    ).rejects.toThrow("capture interrupted");
    expect(await Bun.file(interrupted).exists()).toBe(false);
    expect(await Bun.file(`${interrupted}.tmp`).exists()).toBe(false);
    expect(await read()).toEqual(original);

    const empty = { ...source, name: "empty", where: sql`false` };
    expect(await prepareUpgradeSnapshot(f.db, f.path, empty, async () => {})).toBeUndefined();
    expect(await Bun.file(`${f.path}-empty-upgrade.jsonl`).exists()).toBe(false);
    const marker = await prepareUpgradeSnapshot(f.db, f.path, { ...empty, keepEmpty: true }, async () => {});
    expect((await stat(`${f.path}-empty-upgrade.jsonl`)).size).toBe(0);
    await marker!();
    expect(await Bun.file(`${f.path}-empty-upgrade.jsonl`).exists()).toBe(false);
  } finally {
    await f.close();
    await rm(root, { recursive: true, force: true });
  }
});
