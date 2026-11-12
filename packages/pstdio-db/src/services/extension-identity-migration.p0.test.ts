import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "../db/connection.pglite";
import * as s from "../db/schemas.pg";
import { migrateExtensionIdentities } from "./extension-identity-migration";

const old = "pstdio.pstdio-notes";
const next = "pstdio.notes";
const setup = async () => {
  const fixture = await createDb({ path: ":memory:" });
  const now = new Date().toISOString();
  await fixture.db
    .insert(s.projects)
    .values({ id: "project", name: "Project", shorthand: "P", created_at: now, updated_at: now });
  return { ...fixture, now };
};

test("migration retains complete owner history, immutable bytes, sequence positions and source/instance IDs", async () => {
  const { db, close, now } = await setup();
  try {
    await db.insert(s.installed_extension_sources).values({
      id: "source",
      install_name: "pstdio-notes",
      extension_id: old,
      display_name: "Notes",
      source_path: "/installed/pstdio-notes",
      source_kind: "local_path",
      manifest_json: { name: "pstdio-notes", publisher: "pstdio" },
      created_at: now,
      updated_at: now,
    });
    await db.insert(s.installed_extension_sources).values({
      id: "custom-source",
      install_name: "my-notes",
      extension_id: old,
      display_name: "Notes",
      source_path: "/installed/custom-notes",
      source_kind: "local_path",
      manifest_json: { version: "1.0.0" },
      created_at: now,
      updated_at: now,
    });
    await db.insert(s.extension_instances).values({
      id: "instance",
      installed_extension_id: "source",
      scope_type: "project",
      scope_id: "project",
      enabled: false,
      created_at: now,
      updated_at: now,
    });
    const owner = { workbench_id: "project", extension_id: old };
    const bytes = new Uint8Array([0, 255, 19, 0, 4]);
    await db
      .insert(s.storage_documents)
      .values({ ...owner, document_id: "records", state: bytes, revision: 31, folded_revision: 8 });
    await db
      .insert(s.storage_document_updates)
      .values({ ...owner, document_id: "records", revision: 31, update: bytes });
    await db
      .insert(s.storage_ordered_owners)
      .values({ ...owner, epoch: "epoch", after: 42, joined: true, pending_bytes: 10, receipt_root: bytes });
    await db
      .insert(s.storage_ordered_operations)
      .values({ ...owner, operation_id: "save", fingerprint: "immutable", local_sequence: 19, envelope: bytes });
    await db
      .insert(s.storage_ordered_touches)
      .values({ ...owner, operation_id: "save", record_id: "note", local_sequence: 19 });
    await db.insert(s.storage_ordered_receipts).values({
      ...owner,
      operation_id: "save",
      epoch: "epoch",
      admission_fingerprint: "receipt",
      state: "accepted",
      indexed: true,
    });
    await db.insert(s.extension_settings).values({
      owner_type: "project",
      owner_id: "project",
      extension_id: old,
      key: "folder",
      value_json: { text: old },
      created_at: now,
      updated_at: now,
    });
    await migrateExtensionIdentities(db);
    expect((await db.select().from(s.storage_documents))[0]).toMatchObject({
      ...owner,
      extension_id: next,
      state: bytes,
      revision: 31,
      folded_revision: 8,
    });
    expect((await db.select().from(s.storage_document_updates))[0]?.update).toEqual(bytes);
    expect((await db.select().from(s.storage_ordered_operations))[0]).toMatchObject({
      extension_id: next,
      operation_id: "save",
      fingerprint: "immutable",
      local_sequence: 19,
      envelope: bytes,
    });
    expect((await db.select().from(s.storage_ordered_receipts))[0]).toMatchObject({
      extension_id: next,
      indexed: true,
    });
    expect((await db.select().from(s.storage_ordered_owners))[0]).toMatchObject({
      extension_id: next,
      epoch: "epoch",
      after: 42,
      pending_bytes: 10,
      receipt_root: bytes,
    });
    expect((await db.select().from(s.extension_instances))[0]).toMatchObject({
      id: "instance",
      installed_extension_id: "source",
      enabled: false,
    });
    expect((await db.select().from(s.installed_extension_sources)).find((row) => row.id === "source")).toMatchObject({
      id: "source",
      extension_id: next,
      install_name: "notes",
      source_path: "/installed/pstdio-notes",
    });
    expect(
      (await db.select().from(s.installed_extension_sources)).find((row) => row.id === "custom-source"),
    ).toMatchObject({ install_name: "my-notes", extension_id: next, manifest_json: { version: "1.0.0" } });
    expect((await db.select().from(s.extension_settings))[0]?.value_json).toEqual({ text: old });
    const before = await db.select().from(s.storage_ordered_operations);
    await migrateExtensionIdentities(db);
    expect(await db.select().from(s.storage_ordered_operations)).toEqual(before);
  } finally {
    await close();
  }
});

test("distinct canonical and historical data stop migration without overwriting either owner", async () => {
  const { db, close } = await setup();
  try {
    await db.insert(s.storage_documents).values(
      [old, next].map((extension_id, index) => ({
        workbench_id: "project",
        extension_id,
        document_id: "records",
        state: new Uint8Array([index]),
      })),
    );
    await expect(migrateExtensionIdentities(db)).rejects.toThrow(/conflict.*project/i);
    expect(await db.select().from(s.storage_documents).where(eq(s.storage_documents.extension_id, old))).toHaveLength(
      1,
    );
    expect(await db.select().from(s.storage_documents).where(eq(s.storage_documents.extension_id, next))).toHaveLength(
      1,
    );
  } finally {
    await close();
  }
});

test("a quarantined canonical source can resume after the conflicting historical data is removed", async () => {
  const { db, close, now } = await setup();
  try {
    await db.insert(s.installed_extension_sources).values({
      id: "source",
      extension_id: next,
      install_name: "notes",
      display_name: "Notes",
      source_path: "/installed/pstdio-notes",
      source_kind: "local_path",
      manifest_json: { name: "notes", publisher: "pstdio" },
      status: "error",
      last_error_json: { code: "extension_identity_conflict", message: "Resolved externally" },
      created_at: now,
      updated_at: now,
    });
    await migrateExtensionIdentities(db);
    expect((await db.select().from(s.installed_extension_sources))[0]).toMatchObject({
      status: "pending",
      last_error_json: null,
    });
  } finally {
    await close();
  }
});

test.each(
  [false, true].flatMap((marked) => ["source", "target"].map((endpoint) => ({ marked, endpoint }))),
)("a scoped migration finds $endpoint references with an existing marker: $marked", async ({ marked, endpoint }) => {
  const { db, close, now } = await setup();
  const planner = "pstdio.pstdio-planner";
  const details = { type: "ticket", id: "target", metadata: { text: planner } };
  try {
    if (marked) await migrateExtensionIdentities(db);
    else
      await db.insert(s.storage_documents).values({
        workbench_id: "project",
        extension_id: old,
        document_id: "other-owner",
        state: new Uint8Array([17]),
      });
    await db.insert(s.resource_anchors).values({
      project_id: "project",
      source_owner: endpoint === "source" ? planner : "pstdio",
      source_kind: "ticket",
      source_id: `${planner}.opaque-record`,
      target_owner: endpoint === "target" ? planner : "pstdio",
      target_kind: "session",
      target_id: "target",
      details,
    });
    await db.insert(s.automation_principals).values([
      {
        id: `${planner}.opaque-principal`,
        project_id: "project",
        name: planner,
        created_by: "extension",
        created_at: now,
      },
      { id: "user-principal", project_id: "project", name: planner, created_by: "user", created_at: now },
    ]);
    await migrateExtensionIdentities(db, { extensionId: "pstdio.planner" });
    expect((await db.select().from(s.resource_anchors))[0]).toMatchObject({
      source_owner: endpoint === "source" ? "pstdio.planner" : "pstdio",
      target_owner: endpoint === "target" ? "pstdio.planner" : "pstdio",
      source_id: `${planner}.opaque-record`,
      target_id: "target",
      details,
    });
    expect(await db.select().from(s.automation_principals)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `${planner}.opaque-principal`, name: "pstdio.planner" }),
        expect.objectContaining({ id: "user-principal", name: planner }),
      ]),
    );
    if (!marked)
      expect(
        await db.select().from(s.storage_documents).where(eq(s.storage_documents.extension_id, old)),
      ).toMatchObject([{ document_id: "other-owner", state: new Uint8Array([17]) }]);
  } finally {
    await close();
  }
});

test.each([
  "artifacts",
  "base-themes",
  "cloud",
  "home",
  "notes",
  "onboarding",
  "performance",
  "planner",
  "reports",
  "session-browser",
  "skills",
  "workspaces",
  "dev",
])("global migration still discovers the %s owner through an extension principal alone", async (name) => {
  const { db, close, now } = await setup();
  try {
    await db.insert(s.automation_principals).values({
      id: "retained-principal",
      project_id: "project",
      name: `pstdio.pstdio-${name}`,
      created_by: "extension",
      created_at: now,
    });
    await migrateExtensionIdentities(db);
    expect((await db.select().from(s.automation_principals))[0]).toMatchObject({
      id: "retained-principal",
      name: `pstdio.${name}`,
    });
  } finally {
    await close();
  }
});
