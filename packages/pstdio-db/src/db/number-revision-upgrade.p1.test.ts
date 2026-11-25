import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createExtensionResourceSequencesDBService } from "../services/extension-resource-sequences";
import { createDb } from "./connection.pglite";
import { prepareDocumentOwnerUpgrade } from "./document-owner-upgrade";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { prepareOrderedOwnerUpgrade } from "./ordered-owner-upgrade";
import { prepareOwnerProjectionUpgrade } from "./owner-projection-upgrade";

test("released number generations retain identities and reject stale reads after migration and reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "number-revision-upgrade-"));
  const previous = await createTextLogOwnerFixture(root);
  let closed = false;
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    await previous.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      VALUES('project-a','A','A','2026-11-22','2026-11-22'),('project-b','B','B','2026-11-22','2026-11-22');
      INSERT INTO storage_documents(workbench_id,extension_id,document_id,state)
        SELECT id,'pstdio','records',decode('0000','hex') FROM projects;
      INSERT INTO storage_record_projections(workbench_id,extension_id,document_id,revision,live_count)
        SELECT id,'pstdio','records',73,1 FROM projects;
      INSERT INTO storage_resource_projections SELECT id,'pstdio','records',73 FROM projects;
      INSERT INTO storage_resource_identities SELECT id,'card','example.items','item','IT-7','IT',7 FROM projects;
      INSERT INTO storage_resource_aliases SELECT id,'card','IT-5','IT',5 FROM projects;
      INSERT INTO storage_ordered_owners(workbench_id,extension_id) SELECT id,'pstdio' FROM projects;`);
    const path = previous.path;
    await previous.close();
    closed = true;
    connection = await createDb({ path });
    const input = { projectId: "project-a", extensionId: "example.items", kind: "item", id: "card" };
    const assertIdentity = async () => {
      const numbers = createExtensionResourceSequencesDBService(connection!.db);
      expect(await numbers.identity(input)).toEqual({ id: "card", kind: "item", shorthand: "IT-7", aliases: ["IT-5"] });
      expect(
        (
          await connection!.pglite.query(
            "SELECT revision,numbers_revision FROM owners WHERE extension_id='pstdio' ORDER BY project_id",
          )
        ).rows,
      ).toEqual([
        { revision: 73, numbers_revision: 73 },
        { revision: 73, numbers_revision: 73 },
      ]);
    };
    await assertIdentity();
    await connection.close();
    connection = await createDb({ path });
    await assertIdentity();
    await connection.pglite.exec(
      "UPDATE owners SET numbers_revision=72 WHERE project_id='project-a' AND extension_id='pstdio'",
    );
    await expect(createExtensionResourceSequencesDBService(connection.db).identity(input)).rejects.toThrow(
      "projection is stale",
    );
    expect(
      await createExtensionResourceSequencesDBService(connection.db).identity({ ...input, projectId: "project-b" }),
    ).toEqual({ id: "card", kind: "item", shorthand: "IT-7", aliases: ["IT-5"] });
  } finally {
    if (!closed) await previous.close();
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a partially restored number generation retains every input and refuses a changed owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "number-revision-resume-"));
  const previous = await createTextLogOwnerFixture(root);
  let closed = false;
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    await previous.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      SELECT 'p-'||lpad(n::text,3,'0'),'P','P'||n,'2026-11-22','2026-11-22' FROM generate_series(0,200)n;
      INSERT INTO storage_documents(workbench_id,extension_id,document_id,state)
        SELECT id,'pstdio','records',decode('0000','hex') FROM projects;
      INSERT INTO storage_record_projections(workbench_id,extension_id,document_id,revision,live_count)
        SELECT id,'pstdio','records',73,0 FROM projects;
      INSERT INTO storage_resource_projections SELECT id,'pstdio','records',73 FROM projects;
      INSERT INTO storage_ordered_owners(workbench_id,extension_id) SELECT id,'pstdio' FROM projects;`);
    await prepareOrderedOwnerUpgrade(previous.db, previous.path);
    await prepareOwnerProjectionUpgrade(previous.db, previous.path);
    const finish = await prepareDocumentOwnerUpgrade(previous.db, previous.path);
    await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
    await previous.pglite.exec(`CREATE FUNCTION stop_number_restore() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.project_id='p-200' THEN RAISE EXCEPTION 'stop number restoration'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER stop_number_restore BEFORE UPDATE OF numbers_revision ON owners
        FOR EACH ROW EXECUTE FUNCTION stop_number_restore()`);
    await expect(finish!()).rejects.toThrow("Failed query");
    expect(
      (await previous.pglite.query("SELECT count(*)::int AS n FROM owners WHERE numbers_revision=73")).rows,
    ).toEqual([{ n: 200 }]);
    const input = `${previous.path}-storage_resource_projections-owners-upgrade.jsonl`;
    expect((await readFile(input, "utf8")).trim().split("\n")).toHaveLength(201);
    await previous.pglite.exec("UPDATE owners SET numbers_revision=999 WHERE project_id='p-000'");
    await expect(finish!()).rejects.toThrow("Number projection restoration conflict");
    expect((await previous.pglite.query("SELECT numbers_revision FROM owners WHERE project_id='p-000'")).rows).toEqual([
      { numbers_revision: 999 },
    ]);
    await previous.pglite.exec(`UPDATE owners SET numbers_revision=73 WHERE project_id='p-000';
      DROP TRIGGER stop_number_restore ON owners`);
    await previous.close();
    closed = true;
    connection = await createDb({ path: previous.path });
    expect(
      (await connection.pglite.query("SELECT count(*)::int AS n FROM owners WHERE revision=73 AND numbers_revision=73"))
        .rows,
    ).toEqual([{ n: 201 }]);
    expect(await Bun.file(input).exists()).toBe(false);
    const archive = await readFile(`${previous.path}-migration-exports/storage_resource_projections.jsonl`, "utf8");
    expect(archive.trim().split("\n")).toHaveLength(201);
  } finally {
    if (!closed) await previous.close();
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 10_000);
