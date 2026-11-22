import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readClosedDocumentText } from "pstdio-db/test-fixtures";
import type { StackApi } from "pstdio-scripts/testing";
import * as Y from "yjs";
import savedQuota from "./fixtures/home-quota-047.json";
import type { ProjectUpgradeInput } from "./project-upgrade-fixture";

const historical = "pstdio.pstdio-home";
const canonical = "pstdio.home";

// A released 0.47 record writer authored these two disjoint synthetic quota samples in
// separate Home streams. Keep the original operations and receipts. The observation date
// is beyond the retention cutoff so opening Home cannot legitimately expire the samples.
const loadSavedQuota = async (db: PGlite, project: string, owners: string[]) => {
  const tables = [
    "storage_documents",
    "storage_record_projections",
    "storage_ordered_owners",
    "storage_ordered_operations",
    "storage_ordered_records",
    "storage_current_records",
    "storage_ordered_receipts",
  ] as const;
  await db.transaction(async (tx) => {
    // Home's hourly read may already have initialized an empty journal on the released host.
    // Seed only an unused stream. The three empty rows are the defaults produced by records.list().
    for (const table of [
      "storage_current_records",
      "storage_ordered_records",
      "storage_ordered_operations",
      "storage_ordered_receipts",
    ]) {
      const existing = await tx.query(
        `SELECT 1 FROM ${table} WHERE workbench_id = $1 AND extension_id = ANY($2::text[]) LIMIT 1`,
        [project, owners],
      );
      assert.equal(existing.rows.length, 0, "Expected an unused synthetic Home journal");
    }
    const emptyRows = [
      [
        "storage_documents",
        "document_id = 'records' AND revision = 0 AND folded_revision = 0 AND state = decode('0000', 'hex')",
      ],
      ["storage_record_projections", "document_id = 'records' AND revision = 0 AND live_count = 0"],
      [
        "storage_ordered_owners",
        "epoch IS NULL AND NOT joined AND NOT skipped AND after = 0 AND through = 0 AND pending_bytes = 0 AND state_id IS NULL AND state_bytes = 0 AND receipt_root IS NULL",
      ],
    ] as const;
    for (const [table, empty] of emptyRows) {
      await tx.query(`DELETE FROM ${table} WHERE workbench_id = $1 AND extension_id = ANY($2::text[]) AND ${empty}`, [
        project,
        owners,
      ]);
    }
    for (const table of tables) {
      const columns = Object.keys(savedQuota[table][0]!)
        .filter((name) => name !== "local_sequence")
        .map((name) => `"${name}"`)
        .join(", ");
      // Only the released columns are inserted. Newer baseline columns keep their defaults.
      await tx.query(
        `INSERT INTO ${table} (workbench_id, ${columns})
         SELECT $1, ${columns} FROM jsonb_populate_recordset(NULL::${table}, $2::jsonb)`,
        [project, JSON.stringify(savedQuota[table].filter((row) => owners.includes(row.extension_id)))],
      );
    }
  });
};

const quotaJournalSql = (table: string, numeric: boolean, consolidated: boolean) => {
  if (consolidated)
    return {
      from: `operations t JOIN owners o ON t.owner_id=o.id${table === "storage_ordered_receipts" ? " CROSS JOIN LATERAL jsonb_each(t.receipt) fact(key,value)" : ""}`,
      address: "o.project_id=$1 AND o.extension_id=$2",
      retained:
        table === "storage_ordered_receipts"
          ? `jsonb_build_object('extension_id',o.extension_id,'operation_id',t.operation_id,'epoch',fact.key,
        'admission_fingerprint',fact.value->>'admissionFingerprint','state',fact.value->>'state',
        'indexed',(fact.value->>'indexed')::boolean)`
          : "(to_jsonb(t)-'owner_id'-'touches'-'receipt_epoch'-'receipt'-'receipt_indexed') || jsonb_build_object('extension_id',o.extension_id)",
    };
  if (numeric)
    return {
      from: `${table} t JOIN owners o ON t.owner_id=o.id`,
      address: "o.project_id=$1 AND o.extension_id=$2",
      retained: "(to_jsonb(t)-'owner_id') || jsonb_build_object('extension_id',o.extension_id)",
    };
  return { from: `${table} t`, address: "t.workbench_id=$1 AND t.extension_id=$2", retained: "to_jsonb(t)" };
};

const assertSavedQuota = async (db: PGlite, project: string, owners: string[], migrated: boolean) => {
  const {
    rows: [layout],
  } = await db.query<{ numeric: boolean; documents: boolean; consolidated: boolean }>(`SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='storage_ordered_operations' AND column_name='owner_id') AS numeric, to_regclass('public.operations') IS NOT NULL AS consolidated, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='storage_current_records' AND column_name='owner_id') AS documents`);
  for (const sample of savedQuota.storage_current_records.filter((row) => owners.includes(row.extension_id))) {
    const owner = migrated ? canonical : sample.extension_id;
    const { rows } = await db.query<{ value: unknown }>(
      layout!.documents
        ? "SELECT value FROM storage_current_records WHERE owner_id=(SELECT id FROM owners WHERE project_id=$1 AND extension_id=$2) AND record_id=$3 AND NOT deleted"
        : "SELECT value FROM storage_current_records WHERE workbench_id = $1 AND extension_id = $2 AND record_id = $3 AND NOT deleted",
      [project, owner, sample.record_id],
    );
    assert.deepEqual(
      rows.map((row) => row.value),
      [sample.value],
      "Home must retain each saved quota observation",
    );
    for (const table of ["storage_ordered_operations", "storage_ordered_receipts"] as const) {
      for (const entry of savedQuota[table].filter((row) => row.extension_id === sample.extension_id)) {
        // local_sequence is assigned by the receiving database on insert.
        const data = { ...entry, extension_id: owner };
        const { from, address, retained } = quotaJournalSql(table, layout!.numeric, layout!.consolidated);
        const matches = await db.query(
          `SELECT 1 FROM ${from} WHERE ${address} AND t.operation_id = $3 AND (${retained}) @> ($4::jsonb - 'local_sequence')`,
          [project, owner, entry.operation_id, JSON.stringify(data)],
        );
        assert.equal(matches.rows.length, 1, `Home lost or changed ${table} for ${sample.record_id}`);
      }
    }
  }
};

const enabledHomeSources = async (db: PGlite, project: string) => {
  const {
    rows: [schema],
  } = await db.query<{ current: boolean; projects: boolean }>(
    "SELECT to_regclass('public.extensions') IS NOT NULL AS current, to_regclass('public.project_extensions') IS NOT NULL AS projects",
  );
  const sourceTable = schema!.current ? "extensions" : "installed_extension_sources";
  const membership = schema!.projects ? "project_extensions" : "extension_instances";
  const sourceRef = schema!.projects ? "extension_ref" : "installed_extension_id";
  const projectRef = schema!.projects ? "project_id" : "scope_id";
  return db.query<{ extension_id: string }>(
    `SELECT DISTINCT s.extension_id FROM ${sourceTable} s JOIN ${membership} i ON i.${sourceRef} = s.id WHERE i.${projectRef} = $1 AND i.enabled AND s.extension_id IN ($2, $3)`,
    [project, historical, canonical],
  );
};

// Open only the stopped disposable profile. The candidate must run the migrations itself.
export const checkHomeHistory = async (input: ProjectUpgradeInput, project: string, before?: { owner: string }) => {
  const path = join(input.home, "pstdio.db");
  await access(join(path, "PG_VERSION"));
  const icu = join(dirname(require.resolve("@electric-sql/pglite-icu-full")), "icu.76.tgz");
  const db = new PGlite(path, { database: "template1", username: "postgres", icuDataDir: Bun.file(icu) });
  try {
    const source = await enabledHomeSources(db, project);
    assert.equal(source.rows.length, 1, "Expected one enabled Home identity in the upgrade fixture");
    const owner = before?.owner ?? source.rows[0]!.extension_id;
    const conflicted = input.profile === "conflicted";
    const owners = conflicted ? [historical, canonical] : [owner];
    if (before && !conflicted)
      assert.equal(source.rows[0]!.extension_id, canonical, "Home must use its active identity");
    if (input.profile !== "active") {
      if (!before) await loadSavedQuota(db, project, owners);
      await assertSavedQuota(db, project, owners, Boolean(before && !conflicted));
    }
    for (const [index, original] of owners.entries()) {
      const key = JSON.stringify(["text-file", `upgrade-home-${index}`]);
      const content = `Saved Home history ${index} — résumé`;
      const document = new Y.Doc();
      try {
        if (!before) {
          document.getText("content").insert(0, content);
          await db.query(
            "INSERT INTO storage_documents (workbench_id, extension_id, document_id, state, revision) VALUES ($1, $2, $3, $4, 1)",
            [project, original, key, Y.encodeStateAsUpdate(document)],
          );
        } else {
          const saved = await readClosedDocumentText(
            db,
            path,
            { workbenchId: project, extensionId: conflicted ? original : canonical },
            key,
          );
          assert.equal(saved, content, `Home changed ${key}`);
        }
      } finally {
        document.destroy();
      }
    }
    return { owner };
  } finally {
    await db.close();
  }
};

export const assertHomeOpens = async (api: StackApi, project: string) => {
  const home = await api.command<{ project: { id: string } }>(project, "pstdio.home.command.read");
  assert.equal(home.project.id, project, "Home must open the upgraded project");
};

// A profile already containing two independent ordered streams is a separate recovery case.
// The release must identify the conflict and preserve both originals through the failed upgrade.
export const assertHomeConflict = async (api: StackApi, project: string) => {
  const path = `/projects/${project}/extensions`;
  const { extensions } = await api.get<{
    extensions: { id: string; extensionId: string; enabled: boolean; lastError?: { code?: string } }[];
  }>(path);
  const home = extensions.find((tool) => tool.enabled && [historical, canonical].includes(tool.extensionId));
  assert(home, "The original Home instance is missing");
  if (home.lastError?.code !== "extension_identity_conflict") {
    await assert.rejects(api.post(`${path}/${home.id}/upgrade`, {}), /extension.identity.conflict/i);
  }
};
