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
import { prepareCanonicalNumberUpgrade } from "./resource-numbers-upgrade";

test("released optimistic numbers, confirmed claims and deleted allocation floors survive consolidation", async () => {
  const root = await mkdtemp(join(tmpdir(), "resource-number-upgrade-"));
  const previous = await createTextLogOwnerFixture(root);
  let closed = false;
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    await previous.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      VALUES('p','P','P','2026-11-22','2026-11-22');
      INSERT INTO storage_documents VALUES('p','pstdio','records',decode('0000','hex'),0,0);
      INSERT INTO storage_record_projections(workbench_id,extension_id,document_id,revision,live_count)
        VALUES('p','pstdio','records',73,1);
      INSERT INTO storage_resource_projections VALUES('p','pstdio','records',73);
      INSERT INTO storage_ordered_owners(workbench_id,extension_id) VALUES('p','pstdio');
      INSERT INTO extension_resource_sequences VALUES('p','pstdio.planner','ticket','PS',10,'2026-11-22','2026-11-22');
      INSERT INTO storage_resource_identities VALUES('p','card','pstdio.planner','ticket','PS-9','PS',9);
      INSERT INTO storage_resource_aliases VALUES
        ('p','card','PS-9','PS',9),('p','card','PS-20','PS',20),
        ('p','card','OLD-500','OLD',500),('p','gone','GONE-700','GONE',700);
      INSERT INTO storage_ordered_resource_numbers VALUES
        ('p','card','PS',20,'pstdio.planner','ticket',1,true),
        ('p','card','OLD',500,'pstdio.planner','ticket',null,false),
        ('p','gone','GONE',700,'','',null,false);`);
    const path = previous.path;
    await previous.close();
    closed = true;
    connection = await createDb({ path });
    const rows = async () =>
      (
        await connection!.pglite.query<{ resource_id: string }>(`SELECT shorthand,resource_id,value::text,
      current,alias,canonical,canonical_current FROM resource_numbers ORDER BY resource_id,shorthand`)
      ).rows;
    const expected = [
      {
        shorthand: "OLD-500",
        resource_id: "card",
        value: "500",
        current: false,
        alias: true,
        canonical: true,
        canonical_current: false,
      },
      {
        shorthand: "PS-1",
        resource_id: "card",
        value: "1",
        current: false,
        alias: false,
        canonical: true,
        canonical_current: true,
      },
      {
        shorthand: "PS-20",
        resource_id: "card",
        value: "20",
        current: false,
        alias: true,
        canonical: true,
        canonical_current: false,
      },
      {
        shorthand: "PS-9",
        resource_id: "card",
        value: "9",
        current: true,
        alias: true,
        canonical: false,
        canonical_current: false,
      },
      {
        shorthand: "GONE-700",
        resource_id: "gone",
        value: "700",
        current: false,
        alias: true,
        canonical: true,
        canonical_current: false,
      },
    ];
    expect(await rows()).toEqual(expected);
    const numbers = createExtensionResourceSequencesDBService(connection.db);
    const input = { projectId: "p", extensionId: "pstdio.planner", kind: "ticket", prefix: "PS" };
    expect(await numbers.identity({ ...input, id: "card" })).toEqual({
      id: "card",
      kind: "ticket",
      shorthand: "PS-9",
      aliases: ["OLD-500", "PS-20"],
    });
    expect(await numbers.identity({ ...input, id: "gone" })).toBeNull();
    expect((await numbers.allocate(input)).shorthand).toBe("PS-21");
    await connection.close();
    connection = await createDb({ path });
    expect((await rows()).filter((row) => row.resource_id === "card" || row.resource_id === "gone")).toEqual(expected);
    expect((await createExtensionResourceSequencesDBService(connection.db).allocate(input)).shorthand).toBe("PS-22");
  } finally {
    if (!closed) await previous.close();
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);

test("confirmed-number restoration resumes after a committed batch without overwriting a changed claim", async () => {
  const root = await mkdtemp(join(tmpdir(), "resource-number-resume-")),
    previous = await createTextLogOwnerFixture(root);
  let closed = false,
    connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    await previous.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      VALUES('p','P','P','2026-11-22','2026-11-22');
      INSERT INTO storage_documents VALUES('p','pstdio','records',decode('0000','hex'),0,0);
      INSERT INTO storage_record_projections(workbench_id,extension_id,document_id,revision,live_count)
        VALUES('p','pstdio','records',73,201);
      INSERT INTO storage_resource_projections VALUES('p','pstdio','records',73);
      INSERT INTO storage_ordered_owners(workbench_id,extension_id) VALUES('p','pstdio');
      INSERT INTO storage_resource_identities SELECT 'p','card-'||lpad(n::text,3,'0'),'pstdio.planner','ticket',
        'PS-'||(3*n+2),'PS',3*n+2 FROM generate_series(0,200)n;
      INSERT INTO storage_resource_aliases SELECT 'p','card-'||lpad(n::text,3,'0'),'PS-'||(3*n+x),'PS',3*n+x
        FROM generate_series(0,200)n CROSS JOIN generate_series(1,3)x;
      INSERT INTO storage_ordered_resource_numbers SELECT 'p','card-'||lpad(n::text,3,'0'),'PS',3*n+3,
        'pstdio.planner','ticket',3*n+1,true FROM generate_series(0,200)n;`);
    const canonical = await prepareCanonicalNumberUpgrade(previous.db, previous.path);
    await prepareOrderedOwnerUpgrade(previous.db, previous.path);
    await prepareOwnerProjectionUpgrade(previous.db, previous.path);
    const documents = await prepareDocumentOwnerUpgrade(previous.db, previous.path);
    await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
    await documents!();
    await previous.pglite.exec(`CREATE FUNCTION stop_number_claim() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.canonical AND NEW.resource_id='card-200' THEN RAISE EXCEPTION 'stop confirmed numbers'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER stop_number_claim BEFORE INSERT OR UPDATE ON resource_numbers FOR EACH ROW EXECUTE FUNCTION stop_number_claim()`);
    await expect(canonical!()).rejects.toThrow("Failed query");
    expect(
      (await previous.pglite.query("SELECT count(*)::int AS n FROM resource_numbers WHERE canonical")).rows,
    ).toEqual([{ n: 400 }]);
    const input = `${previous.path}-canonical-resource-numbers-upgrade.jsonl`;
    expect((await readFile(input, "utf8")).trim().split("\n")).toHaveLength(201);
    await previous.pglite.exec(
      "UPDATE resource_numbers SET value=999 WHERE resource_id='card-000' AND shorthand='PS-1'",
    );
    await expect(canonical!()).rejects.toThrow("Resource number restoration conflict");
    expect(
      (
        await previous.pglite.query(
          "SELECT value::text FROM resource_numbers WHERE resource_id='card-000' AND shorthand='PS-1'",
        )
      ).rows,
    ).toEqual([{ value: "999" }]);
    await previous.pglite.exec(`UPDATE resource_numbers SET value=1 WHERE resource_id='card-000' AND shorthand='PS-1';
      DROP TRIGGER stop_number_claim ON resource_numbers`);
    await previous.close();
    closed = true;
    connection = await createDb({ path: previous.path });
    expect(
      (await connection.pglite.query("SELECT count(*)::int AS n FROM resource_numbers WHERE canonical")).rows,
    ).toEqual([{ n: 402 }]);
    expect(
      (await connection.pglite.query("SELECT count(*)::int AS n FROM resource_numbers WHERE current")).rows,
    ).toEqual([{ n: 201 }]);
    expect(await Bun.file(input).exists()).toBe(false);
    expect(
      (await readFile(`${previous.path}-migration-exports/storage_ordered_resource_numbers.jsonl`, "utf8"))
        .trim()
        .split("\n"),
    ).toHaveLength(201);
  } finally {
    if (!closed) await previous.close();
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);

test("released large-number aliases and deleted confirmed floors retain exact allocation exhaustion after reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "resource-number-bigint-"));
  const previous = await createTextLogOwnerFixture(root);
  let closed = false;
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    await previous.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      VALUES('p','P','P','2026-11-22','2026-11-22');
      INSERT INTO storage_documents VALUES('p','pstdio','records',decode('0000','hex'),0,0);
      INSERT INTO storage_record_projections(workbench_id,extension_id,document_id,revision,live_count)
        VALUES('p','pstdio','records',1,1);
      INSERT INTO storage_resource_projections VALUES('p','pstdio','records',1);
      INSERT INTO storage_ordered_owners(workbench_id,extension_id) VALUES('p','pstdio');
      INSERT INTO storage_resource_identities VALUES('p','card','example.items','item','IT-3','IT',3);
      INSERT INTO storage_resource_aliases VALUES('p','card','旧-9007199254740993','旧',9007199254740993);
      INSERT INTO storage_ordered_resource_numbers VALUES
        ('p','gone','MAX',9223372036854775807,'','',null,false);`);
    await previous.close();
    closed = true;
    for (let reopen = 0; reopen < 2; reopen++) {
      connection = await createDb({ path: previous.path });
      expect(
        (
          await connection.pglite.query(`SELECT shorthand,value::text,current,alias,canonical FROM resource_numbers
        WHERE value > 9007199254740991 ORDER BY shorthand`)
        ).rows,
      ).toEqual([
        {
          shorthand: "MAX-9223372036854775807",
          value: "9223372036854775807",
          current: false,
          alias: false,
          canonical: true,
        },
        { shorthand: "旧-9007199254740993", value: "9007199254740993", current: false, alias: true, canonical: false },
      ]);
      const numbers = createExtensionResourceSequencesDBService(connection.db);
      expect(
        (await numbers.identity({ projectId: "p", extensionId: "example.items", kind: "item", id: "card" }))?.aliases,
      ).toEqual(["旧-9007199254740993"]);
      for (const prefix of ["旧", "MAX"])
        await expect(
          numbers.allocate({ projectId: "p", extensionId: "example.floor", kind: prefix, prefix }),
        ).rejects.toThrow("range exhausted");
      expect((await connection.pglite.query("SELECT count(*)::int AS n FROM resource_prefixes")).rows).toEqual([
        { n: 0 },
      ]);
      await connection.close();
      connection = undefined;
    }
    expect(
      await readFile(`${previous.path}-migration-exports/storage_ordered_resource_numbers.jsonl`, "utf8"),
    ).toContain('"high_water":"9223372036854775807"');
  } finally {
    if (!closed) await previous.close();
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);

for (const defaultMetadata of [false, true])
  test(`historical and canonical extension spellings restore the same number before identity rename${defaultMetadata ? " with released metadata defaults" : ""}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "resource-number-namespace-")),
      previous = await createTextLogOwnerFixture(root);
    let closed = false,
      connection: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      await previous.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      VALUES('p','P','P','2026-11-22','2026-11-22');
      INSERT INTO storage_documents VALUES('p','pstdio','records',decode('0000','hex'),0,0);
      INSERT INTO storage_record_projections(workbench_id,extension_id,document_id,revision,live_count)
        VALUES('p','pstdio','records',73,1);
      INSERT INTO storage_resource_projections VALUES('p','pstdio','records',73);
      INSERT INTO storage_ordered_owners(workbench_id,extension_id) VALUES('p','pstdio');
      INSERT INTO extension_resource_sequences VALUES('p','pstdio.pstdio-planner','ticket','PS',10,'2026-11-22','2026-11-22');
      INSERT INTO storage_resource_identities(workbench_id,resource_id,extension_id,kind,shorthand${defaultMetadata ? "" : ",prefix,value"}) VALUES('p','card','pstdio.pstdio-planner','ticket','PS-9'${defaultMetadata ? "" : ",'PS',9"});
      INSERT INTO storage_resource_aliases(workbench_id,resource_id,shorthand${defaultMetadata ? "" : ",prefix,value"}) VALUES('p','card','PS-9'${defaultMetadata ? "" : ",'PS',9"});
      INSERT INTO storage_ordered_resource_numbers VALUES('p','card','PS',20,'pstdio.planner','ticket',9,true);`);
      await previous.close();
      closed = true;
      for (let reopen = 0; reopen < 2; reopen++) {
        connection = await createDb({ path: previous.path });
        const numbers = createExtensionResourceSequencesDBService(connection.db),
          input = { projectId: "p", extensionId: "pstdio.planner", kind: "ticket", prefix: "PS" };
        expect(await numbers.identity({ ...input, id: "card" })).toEqual({
          id: "card",
          kind: "ticket",
          shorthand: "PS-9",
          aliases: [],
        });
        expect((await numbers.allocate(input)).shorthand).toBe(`PS-${21 + reopen}`);
        expect((await connection.pglite.query("SELECT DISTINCT extension_id FROM resource_numbers")).rows).toEqual([
          { extension_id: "pstdio.planner" },
        ]);
        await connection.close();
        connection = undefined;
      }
      expect(await readFile(`${previous.path}-migration-exports/storage_resource_identities.jsonl`, "utf8")).toContain(
        '"extension_id":"pstdio.pstdio-planner"',
      );
      expect(
        await readFile(`${previous.path}-migration-exports/storage_ordered_resource_numbers.jsonl`, "utf8"),
      ).toContain('"extension_id":"pstdio.planner"');
      if (defaultMetadata) {
        const original = await readFile(`${previous.path}-migration-exports/storage_resource_identities.jsonl`, "utf8");
        expect(original).toContain('"prefix":""');
        expect(original).toContain('"value":"0"');
      }
    } finally {
      if (!closed) await previous.close();
      await connection?.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);
