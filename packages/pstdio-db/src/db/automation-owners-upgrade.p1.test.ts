import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createAutomationDBService } from "../services/automation/automation";
import {
  type AutomationPrincipal,
  storeDisabledAutomationOwner,
  storeExtensionAutomationOwner,
} from "../services/automation/automation-owners";
import { createProjectsDBService } from "../services/projects/projects";
import { prepareAutomationOwnersUpgrade } from "./automation-owners-upgrade";
import { createDb } from "./connection.pglite";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";
import { automation_runs, automation_tokens } from "./schemas/automation";

const stamp = "2026-11-20T12:00:00.000Z";
const owner = (
  id: string,
  name: string,
  created_by = "user",
  disabled_at: string | null = null,
): AutomationPrincipal => ({ id, project_id: "project", name, created_by, created_at: stamp, disabled_at });
const principals = [
  owner("machine-owner", "Retained machine"),
  owner("disabled-owner", "Blocked", "user", stamp),
  owner("opaque-extension:owner", "example.retained", "extension"),
  owner("second-extension-owner", "example.retained", "extension"),
  owner("disabled-extension", "example.disabled", "extension", stamp),
];
const restorePart = async (store: Awaited<ReturnType<typeof createDb>>, path: string, partial: boolean) => {
  for (const principal of principals) {
    if (principal.created_by === "extension") await storeExtensionAutomationOwner(store.db, principal);
    else await storeDisabledAutomationOwner(store.db, principal);
  }
  for (const [name, table] of [
    ["automation-tokens", automation_tokens],
    ["automation-runs", automation_runs],
  ] as const) {
    const rows = (await Bun.file(`${path}-${name}-upgrade.jsonl`).text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    for (const row of partial ? rows.slice(0, 1) : rows) await store.db.insert(table).values(row).onConflictDoNothing();
  }
};
for (const interruption of ["normal", "capture", "schema", "partial-restore", "partial-cleanup"])
  test(`released automation authentication and run identity survive ${interruption}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "automation-owners-upgrade-"));
    const path = join(root, "database");
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      store = await createDb({ path });
      await createProjectsDBService(store.db).create({ id: "project", name: "Released automation" });
      await restoreReleasedPreferenceTables(store);
      for (const principal of principals)
        await store.pglite.query(
          "INSERT INTO automation_principals (id, project_id, name, created_by, created_at, disabled_at) VALUES ($1, $2, $3, $4, $5, $6)",
          Object.values(principal),
        );
      for (const [id, principal] of [
        ["active", "machine-owner"],
        ["rotated", "machine-owner"],
        ["disabled", "disabled-owner"],
      ])
        await store.pglite.query(
          "INSERT INTO automation_tokens VALUES ($1, $2, $3, $4, 'project', $5::jsonb, '2099-01-01T00:00:00.000Z', NULL, NULL, $6)",
          [
            id,
            principal,
            `pst_at_${id}`,
            `private-digest-${id}`,
            JSON.stringify(["example.retained.command.run"]),
            stamp,
          ],
        );
      for (const [id, principal, token, status, started, finished] of [
        ["queued", "machine-owner", "active", "queued", null, null],
        ["finished", "machine-owner", "rotated", "succeeded", stamp, stamp],
        ["extension", "opaque-extension:owner", null, "running", stamp, null],
        ["extension-alias", "second-extension-owner", null, "queued", null, null],
      ])
        await store.pglite.query(
          "INSERT INTO automation_runs VALUES ($1, 'project', $2, $3, 'example.retained.command.run', $1, $4, $5::jsonb, $6, NULL, NULL, $7, $8, $9)",
          [id, principal, token, `hash-${id}`, JSON.stringify({ input: "日本語" }), status, stamp, started, finished],
        );
      if (interruption !== "normal") {
        await prepareAutomationOwnersUpgrade(store.db, path);
        if (interruption !== "capture")
          await migrate(store.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
        if (interruption.startsWith("partial-")) await restorePart(store, path, interruption === "partial-restore");
        if (interruption === "partial-cleanup") await rm(`${path}-automation-owners-upgrade.jsonl`);
      }
      await store.close();
      store = await createDb({ path });
      const service = createAutomationDBService(store.db);
      const token = await service.getToken("active");
      expect(token).toMatchObject({
        principal: principals[0],
        token: {
          id: "active",
          principal_id: "machine-owner",
          token_digest: "private-digest-active",
          command_scopes_json: ["example.retained.command.run"],
          revoked_at: null,
        },
      });
      expect((await service.getPrincipal("project", "second-extension-owner"))?.id).toBe("second-extension-owner");
      expect((await service.getToken("disabled"))?.token.revoked_at).toBe(stamp);
      const blockedRotation = await service.createToken({
        name: "Cannot bypass block",
        createdBy: "user",
        principalId: "disabled-owner",
        tokenId: "blocked-rotation",
        tokenPrefix: "blocked-rotation",
        tokenDigest: "blocked-digest",
        projectId: "project",
        commandScopes: [],
        expiresAt: "2099-01-01T00:00:00.000Z",
      });
      expect(blockedRotation.principal.disabled_at).toBe(stamp);
      expect(blockedRotation.token.revoked_at).toBe(stamp);
      expect(await service.getRun("project", "extension")).toMatchObject({
        principal_id: "opaque-extension:owner",
        status: "running",
        input_json: { input: "日本語" },
      });
      expect(
        await service.getExtensionRun({ projectId: "project", extensionId: "example.retained" }, "extension"),
      ).toMatchObject({ id: "extension" });
      expect(
        (await service.getOrCreateExtensionPrincipal({ projectId: "project", extensionId: "example.disabled" }))
          .disabled_at,
      ).toBe(stamp);
      const retry = await service.createRun({
        projectId: "project",
        principalId: "machine-owner",
        tokenId: "rotated",
        commandId: "example.retained.command.run",
        idempotencyKey: "queued",
        inputHash: "hash-queued",
        inputJson: { input: "日本語" },
      });
      expect(retry.created).toBe(false);
      expect(retry.run.id).toBe("queued");
      const events = await service.listRunEvents("finished");
      expect(events.map((event) => event.type)).toEqual(["queued", "running", "succeeded"]);
      expect((await service.listRunEvents("finished", events[1].cursor)).map((event) => event.type)).toEqual([
        "succeeded",
      ]);
      expect((await readdir(root)).filter((file) => file.endsWith("-upgrade.jsonl"))).toEqual([]);
      await store.close();
      store = await createDb({ path });
      expect((await createAutomationDBService(store.db).getToken("active"))?.token.token_digest).toBe(
        "private-digest-active",
      );
    } finally {
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });

for (const mismatch of ["token-project", "run-token"])
  test(`an inconsistent released ${mismatch} owner cannot gain authority during migration`, async () => {
    const root = await mkdtemp(join(tmpdir(), "automation-owner-boundary-"));
    const path = join(root, "database");
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      store = await createDb({ path });
      for (const id of ["project", "foreign"]) await createProjectsDBService(store.db).create({ id, name: id });
      await restoreReleasedPreferenceTables(store);
      await store.pglite.query(
        "INSERT INTO automation_principals VALUES ('owner','project','Owner','user',$1,NULL), ('peer',$2,'Peer','user',$1,NULL)",
        [stamp, mismatch === "token-project" ? "foreign" : "project"],
      );
      await store.pglite.query(
        "INSERT INTO automation_tokens VALUES ('token','peer','prefix','digest','project','[]'::jsonb,'2099-01-01',NULL,NULL,$1)",
        [stamp],
      );
      if (mismatch === "run-token")
        await store.pglite.query(
          "INSERT INTO automation_runs VALUES ('run','project','owner','token','command','key','hash','{}'::jsonb,'queued',NULL,NULL,$1,NULL,NULL)",
          [stamp],
        );
      await expect(prepareAutomationOwnersUpgrade(store.db, path)).rejects.toThrow("ownership");
      expect((await store.pglite.query("SELECT * FROM automation_tokens")).rows).toHaveLength(1);
      expect((await store.pglite.query("SELECT * FROM automation_principals")).rows).toHaveLength(2);
    } finally {
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
