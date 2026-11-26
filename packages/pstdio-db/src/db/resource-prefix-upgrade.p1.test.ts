import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createExtensionResourceSequencesDBService } from "../services/extension-resource-sequences";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";
import { prepareResourcePrefixUpgrade } from "./resource-prefix-upgrade";

test("released prefix ownership and exhausted allocation floors survive migration and reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "resource-prefix-upgrade-"));
  const released = await createTextLogOwnerFixture(root);
  let releasedClosed = false;
  let current: Awaited<ReturnType<typeof createDb>> | undefined;
  let numbers: ReturnType<typeof createExtensionResourceSequencesDBService> | undefined;
  try {
    await released.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      VALUES('project','Project','P','2026-11-22','2026-11-22');
      INSERT INTO extension_resource_sequences(project_id,extension_id,kind,prefix,next_value,created_at,updated_at)
      SELECT 'project','example.'||lpad(n::text,3,'0'),'item','K'||n,n+10,'2026-11-20','2026-11-21'
      FROM generate_series(0,200) n;
      INSERT INTO extension_resource_sequences VALUES
        ('project','pstdio.pstdio-planner','ticket','PS',125,'2026-11-20','2026-11-21'),
        ('project','example.exhausted','item','EX',9007199254740992,'2026-11-20','2026-11-21'),
        ('project','example.maximum','item','MX',9223372036854775807,'2026-11-20','2026-11-21')`);
    const original = (
      await released.pglite.query<{ row: Record<string, unknown> }>(
        "SELECT to_jsonb(s)||jsonb_build_object('next_value',next_value::text) AS row FROM extension_resource_sequences s ORDER BY extension_id,kind",
      )
    ).rows.map(({ row }) => row);
    await released.close();
    releasedClosed = true;
    current = await createDb({ path: released.path });
    expect((await current.pglite.query("SELECT * FROM resource_prefixes")).rows).toHaveLength(204);
    expect(
      (
        await current.pglite.query(
          "SELECT prefix,next_value::text AS next FROM resource_prefixes WHERE prefix IN ('EX','MX') ORDER BY prefix",
        )
      ).rows,
    ).toEqual([
      { prefix: "EX", next: "9007199254740992" },
      { prefix: "MX", next: "9223372036854775807" },
    ]);
    const input = { projectId: "project", extensionId: "pstdio.planner", kind: "ticket", prefix: "PS" };
    numbers = createExtensionResourceSequencesDBService(current.db);
    expect((await numbers.allocateMany({ ...input, count: 2 })).map((value) => value.shorthand)).toEqual([
      "PS-125",
      "PS-126",
    ]);
    await expect(numbers.allocate({ ...input, extensionId: "example.other" })).rejects.toThrow("pstdio.planner");
    await expect(
      numbers.allocate({ projectId: "project", extensionId: "example.exhausted", kind: "item", prefix: "EX" }),
    ).rejects.toThrow("range exhausted");
    const archived = (await readFile(`${released.path}-migration-exports/extension_resource_sequences.jsonl`, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(archived).toEqual(original);
    await numbers.flush();
    numbers = undefined;
    await current.close();
    current = await createDb({ path: released.path });
    numbers = createExtensionResourceSequencesDBService(current.db);
    expect((await numbers.allocate(input)).shorthand).toBe("PS-127");
    expect(
      (await current.pglite.query("SELECT extension_id,kind,next_value FROM resource_prefixes WHERE prefix='PS'")).rows,
    ).toEqual([{ extension_id: "pstdio.planner", kind: "ticket", next_value: 128 }]);
  } finally {
    await numbers?.flush();
    await current?.close();
    if (!releasedClosed) await released.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a released-schema upgrade preserves odd exhausted counters without making their prefixes reusable", async () => {
  const root = await mkdtemp(join(tmpdir(), "resource-prefix-exhausted-"));
  const path = join(root, "database");
  let connection = await createDb({ path });
  let numbers: ReturnType<typeof createExtensionResourceSequencesDBService> | undefined;
  try {
    await connection.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      VALUES('project','Project','P','2026-11-22','2026-11-22');
      INSERT INTO resource_prefixes VALUES
        ('project','ODD','example.odd','item',9007199254740993),
        ('project','MAX','example.maximum','item',9223372036854775807)`);
    await restoreReleasedPreferenceTables(connection);
    await connection.close();
    connection = await createDb({ path });
    numbers = createExtensionResourceSequencesDBService(connection.db);
    for (const [prefix, extensionId] of [
      ["ODD", "example.odd"],
      ["MAX", "example.maximum"],
    ])
      await expect(
        numbers.allocate({ projectId: "project", extensionId: extensionId!, kind: "item", prefix: prefix! }),
      ).rejects.toThrow("range exhausted");
    expect(
      (await connection.pglite.query("SELECT prefix,next_value::text AS next FROM resource_prefixes ORDER BY prefix"))
        .rows,
    ).toEqual([
      { prefix: "MAX", next: "9223372036854775807" },
      { prefix: "ODD", next: "9007199254740993" },
    ]);
  } finally {
    await numbers?.flush();
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("interrupted prefix restoration retains its input and refuses to overwrite a conflicting binding", async () => {
  const root = await mkdtemp(join(tmpdir(), "resource-prefix-restore-"));
  const released = await createTextLogOwnerFixture(root);
  let releasedClosed = false;
  let current: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    await released.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      VALUES('project','Project','P','2026-11-22','2026-11-22');
      INSERT INTO extension_resource_sequences(project_id,extension_id,kind,prefix,next_value,created_at,updated_at)
      SELECT 'project','example.'||lpad(n::text,3,'0'),'item','K'||n,n+10,'2026-11-20','2026-11-21'
      FROM generate_series(0,200) n`);
    const finish = await prepareResourcePrefixUpgrade(released.db, released.path);
    await migrate(released.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
    await released.pglite.exec(`CREATE FUNCTION stop_prefix_restore() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.prefix='K200' THEN RAISE EXCEPTION 'interrupted restoration'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER stop_prefix_restore BEFORE INSERT ON resource_prefixes FOR EACH ROW
        EXECUTE FUNCTION stop_prefix_restore()`);
    await expect(finish!()).rejects.toThrow("Failed query");
    expect((await released.pglite.query("SELECT * FROM resource_prefixes")).rows).toHaveLength(200);
    const source = `${released.path}-resource-prefixes-upgrade.jsonl`;
    expect((await readFile(source, "utf8")).trim().split("\n")).toHaveLength(201);
    await released.pglite.exec("UPDATE resource_prefixes SET next_value=999 WHERE prefix='K0'");
    await expect(finish!()).rejects.toThrow("restoration conflict");
    expect((await released.pglite.query("SELECT next_value FROM resource_prefixes WHERE prefix='K0'")).rows).toEqual([
      { next_value: 999 },
    ]);
    expect(await Bun.file(source).exists()).toBe(true);
    await released.pglite.exec(`UPDATE resource_prefixes SET next_value=10 WHERE prefix='K0';
      DROP TRIGGER stop_prefix_restore ON resource_prefixes`);
    await released.close();
    releasedClosed = true;
    current = await createDb({ path: released.path });
    expect((await current.pglite.query("SELECT * FROM resource_prefixes")).rows).toHaveLength(201);
    expect(await Bun.file(source).exists()).toBe(false);
    expect(
      (await readFile(`${released.path}-migration-exports/extension_resource_sequences.jsonl`, "utf8"))
        .trim()
        .split("\n"),
    ).toHaveLength(201);
  } finally {
    await current?.close();
    if (!releasedClosed) await released.close();
    await rm(root, { recursive: true, force: true });
  }
});
