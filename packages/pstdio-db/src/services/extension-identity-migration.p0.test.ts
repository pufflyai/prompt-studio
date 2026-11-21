import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "../db/connection.pglite";
import * as s from "../db/schemas.pg";
import { getAutomationOwner, storeExtensionAutomationOwner } from "./automation/automation-owners";
import { migrateExtensionIdentities } from "./extension-identity-migration";
import { createExtensionSettingsDBService } from "./extension-settings/extension-settings";

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
    const settings = createExtensionSettingsDBService(db);
    await settings.setValue({
      owner_type: "installed_extension",
      owner_id: "source",
      extension_id: old,
      key: "folder",
      value_json: { text: old },
    });
    await settings.setValue({
      owner_type: "device_extension",
      owner_id: old,
      extension_id: old,
      key: "device-choice",
      value_json: "retained",
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
    expect(
      (
        await settings.getValue({
          owner_type: "installed_extension",
          owner_id: "source",
          extension_id: next,
          key: "folder",
        })
      )?.value_json,
    ).toEqual({ text: old });
    expect(
      (
        await settings.getValue({
          owner_type: "device_extension",
          owner_id: next,
          extension_id: next,
          key: "device-choice",
        })
      )?.value_json,
    ).toBe("retained");
    const before = await db.select().from(s.storage_ordered_operations);
    await migrateExtensionIdentities(db);
    expect(await db.select().from(s.storage_ordered_operations)).toEqual(before);
  } finally {
    await close();
  }
});

test("independent saved text files keep their contents, revisions and retry history under the active owner", async () => {
  const { db, close } = await setup();
  try {
    const workbench_id = "project";
    const historical = "pstdio.pstdio-home";
    const canonical = "pstdio.home";
    for (const [index, extension_id] of [historical, canonical].entries()) {
      const document_id = JSON.stringify(["text-file", `saved-${index}`]);
      const owner = { workbench_id, extension_id, document_id };
      const bytes = new Uint8Array([41, index]);
      await db.insert(s.storage_documents).values({ ...owner, state: bytes, revision: 7, folded_revision: 6 });
      await db.insert(s.storage_document_updates).values({ ...owner, revision: 7, update: bytes });
      await db
        .insert(s.storage_document_operations)
        .values({ ...owner, operation_id: "edit", fingerprint: `saved-${index}` });
    }
    await migrateExtensionIdentities(db);
    await migrateExtensionIdentities(db);
    for (const [index, name] of ["saved-0", "saved-1"].entries()) {
      const document_id = JSON.stringify(["text-file", name]);
      const owner = { workbench_id, extension_id: canonical, document_id };
      const bytes = new Uint8Array([41, index]);
      expect(
        await db.select().from(s.storage_documents).where(eq(s.storage_documents.document_id, document_id)),
      ).toEqual([{ ...owner, state: bytes, revision: 7, folded_revision: 6 }]);
      expect(
        await db
          .select()
          .from(s.storage_document_updates)
          .where(eq(s.storage_document_updates.document_id, document_id)),
      ).toEqual([{ ...owner, revision: 7, update: bytes }]);
      expect(
        await db
          .select()
          .from(s.storage_document_operations)
          .where(eq(s.storage_document_operations.document_id, document_id)),
      ).toEqual([{ ...owner, operation_id: "edit", fingerprint: name }]);
    }
  } finally {
    await close();
  }
});

test.each([
  "records",
  JSON.stringify(["text-file", "same-file"]),
])("overlapping %s histories stop migration without overwriting either owner", async (documentId) => {
  const { db, close } = await setup();
  try {
    await db.insert(s.storage_documents).values(
      [old, next].map((extension_id, index) => ({
        workbench_id: "project",
        extension_id,
        document_id: documentId,
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
    await storeExtensionAutomationOwner(db, {
      id: `${planner}.opaque-principal`,
      project_id: "project",
      name: planner,
      created_by: "extension",
      created_at: now,
      disabled_at: null,
    });
    await db.insert(s.automation_tokens).values({
      id: "user-token",
      principal_id: "user-principal",
      project_id: "project",
      name: planner,
      created_by: "user",
      principal_created_at: now,
      created_at: now,
      token_prefix: "test",
      token_digest: "digest",
      command_scopes_json: [],
      expires_at: "2099-01-01",
    });
    await migrateExtensionIdentities(db, { extensionId: "pstdio.planner" });
    expect((await db.select().from(s.resource_anchors))[0]).toMatchObject({
      source_owner: endpoint === "source" ? "pstdio.planner" : "pstdio",
      target_owner: endpoint === "target" ? "pstdio.planner" : "pstdio",
      source_id: `${planner}.opaque-record`,
      target_id: "target",
      details,
    });
    expect(await getAutomationOwner(db, "project", `${planner}.opaque-principal`)).toMatchObject({
      id: `${planner}.opaque-principal`,
      name: "pstdio.planner",
    });
    expect(await getAutomationOwner(db, "project", "user-principal")).toMatchObject({
      id: "user-principal",
      name: planner,
    });
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
])("global migration still discovers the %s owner through extension automation ownership alone", async (name) => {
  const { db, close, now } = await setup();
  try {
    await storeExtensionAutomationOwner(db, {
      id: "retained-principal",
      project_id: "project",
      name: `pstdio.pstdio-${name}`,
      created_by: "extension",
      created_at: now,
      disabled_at: null,
    });
    await migrateExtensionIdentities(db);
    expect(await getAutomationOwner(db, "project", "retained-principal")).toMatchObject({
      id: "retained-principal",
      name: `pstdio.${name}`,
    });
  } finally {
    await close();
  }
});

test("conflicting device settings keep both values and report a recoverable identity conflict", async () => {
  const { db, close } = await setup();
  try {
    const settings = createExtensionSettingsDBService(db);
    const key = (id: string) => ({
      owner_type: "device_extension" as const,
      owner_id: id,
      extension_id: id,
      key: "selection",
    });
    await settings.setValue({ ...key(old), value_json: "old choice" });
    await settings.setValue({ ...key(next), value_json: "new choice" });
    const conflicts: string[] = [];
    await expect(
      migrateExtensionIdentities(db, {
        onConflict: async (error) => {
          conflicts.push(error.code);
        },
      }),
    ).resolves.toBe(false);
    expect(conflicts).toEqual(["extension_identity_conflict"]);
    expect((await settings.getValue(key(old)))?.value_json).toBe("old choice");
    expect((await settings.getValue(key(next)))?.value_json).toBe("new choice");
  } finally {
    await close();
  }
});
