import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { migrateTicketShorthand, ticketsCollection } from "./collections";
import { requireTicketDraftFiles, TICKETS_DIR } from "./draft-storage";
import { migrateTicketDraft } from "./migrate-ticket-drafts";
import { ticketResourceReference } from "./ticket-resource-hierarchy";

export interface TicketIdentityMigration {
  tickets: { id: string; shorthand: string }[];
  complete: boolean;
  draftsBackedUp?: boolean;
}
export const identityMigrations = (ctx: Pick<ExtensionContextBase, "storage">) =>
  ctx.storage.collection<TicketIdentityMigration>("identity-migrations");
export const IDENTITY_MIGRATION = "ticket-identities-v1";

const BACKUP_ROOT = ".pstdio/ticket-identity-migration";

const runTicketIdentityMigration = async (ctx: ExtensionContextBase) => {
  const migrations = identityMigrations(ctx);
  const tickets = ticketsCollection(ctx.storage);
  let migration = await migrations.get(IDENTITY_MIGRATION);
  if (migration?.complete) return { migrated: 0, complete: true, identities: [] };
  if (!migration) {
    const ordered = (await tickets.list()).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
    await migrations.createIfAbsent(IDENTITY_MIGRATION, {
      tickets: ordered.map(({ id, shorthand }) => ({ id, shorthand })),
      complete: false,
    });
    migration = (await migrations.get(IDENTITY_MIGRATION))!;
  }
  if (migration.tickets.length === 0) {
    await migrations.put(IDENTITY_MIGRATION, { ...migration, complete: true });
    return { migrated: 0, complete: true, identities: [] };
  }
  const { projectFiles } = await requireTicketDraftFiles(ctx);
  // Keep the original checkout before replacing paths, including unsaved and orphaned files.
  if (!migration.draftsBackedUp) {
    for (const file of await projectFiles.list(`${TICKETS_DIR}/**`)) {
      const backup = `${BACKUP_ROOT}/${file.path}`;
      if (!(await projectFiles.exists(backup)))
        await projectFiles.writeBytes(backup, await projectFiles.readBytes(file.path));
    }
    migration = { ...migration, draftsBackedUp: true };
    await migrations.put(IDENTITY_MIGRATION, migration);
  }
  const allocations = ctx.storage.collection<{ shorthand: string }>("ticket-identity-allocations");
  for (const ticket of migration.tickets) {
    if (!(await allocations.get(ticket.id))) {
      const identity = await ctx.resources.allocate({ kind: "ticket" });
      await allocations.createIfAbsent(ticket.id, { shorthand: identity.shorthand });
    }
  }
  for (const original of migration.tickets) {
    const identity = (await allocations.get(original.id))!;
    await migrateTicketShorthand(ctx.storage, original.id, identity.shorthand);
  }
  // A project can reach the migration with no drafts checked out, and a resumed run
  // has already removed them, so only clear the directory when it is there.
  if (await projectFiles.exists(TICKETS_DIR)) await projectFiles.delete(TICKETS_DIR);
  const migrated = await tickets.list();
  const byId = new Map(migrated.map((ticket) => [ticket.id, ticket]));
  const identities = new Map(
    migration.tickets.flatMap((original) => {
      const ticket = byId.get(original.id);
      return ticket ? [[original.shorthand.toUpperCase(), ticket.shorthand] as const] : [];
    }),
  );
  for (const ticket of migrated) {
    const original = migration.tickets.find((original) => original.id === ticket.id)!;
    await migrateTicketDraft({
      projectFiles,
      storage: ctx.storage,
      backupRoot: BACKUP_ROOT,
      previousShorthand: original.shorthand,
      ticket,
      identities,
    });
  }
  for (const session of await ctx.sessions.list()) {
    const anchors = (session.anchors_json ?? []).flatMap((anchor) => {
      const ticket = anchor.type === "ticket" ? byId.get(anchor.id) : undefined;
      return ticket ? [{ ...anchor, ...ticketResourceReference(ticket, byId) }] : [];
    });
    if (anchors.length) await ctx.sessions.addAnchors(session.id, anchors);
  }
  const workspaces = (await ctx.workspaces.list()).filter((workspace) =>
    (workspace.anchors_json ?? []).some((anchor) => anchor.type === "ticket" && byId.has(anchor.id)),
  );
  await migrations.put(IDENTITY_MIGRATION, { ...migration, complete: true });
  return {
    migrated: migrated.length,
    complete: true,
    backupPath: BACKUP_ROOT,
    identities: migration.tickets.flatMap((original) => {
      const ticket = byId.get(original.id);
      return ticket ? [{ id: ticket.id, previousShorthand: original.shorthand, shorthand: ticket.shorthand }] : [];
    }),
    manualWorkspaceCleanup: workspaces.map((workspace) => ({
      id: workspace.id,
      shorthand: workspace.workspace_shorthand,
      branch: workspace.branch,
      path: workspace.root_path,
    })),
  };
};

// Commands in one host share a migration until it settles. The persisted journal
// resumes work after a host restart or a failed run.
const pendingMigrations = new Map<string, ReturnType<typeof runTicketIdentityMigration>>();

export const migrateTicketIdentities = (ctx: ExtensionContextBase) => {
  const key = JSON.stringify([ctx.extensionId, ctx.projectId]);
  const pending = pendingMigrations.get(key);
  if (pending) return pending;
  const migration = runTicketIdentityMigration(ctx).finally(() => pendingMigrations.delete(key));
  pendingMigrations.set(key, migration);
  return migration;
};
