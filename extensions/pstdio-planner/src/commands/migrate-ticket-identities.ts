import { requireRepoFiles } from "@pstdio/sdk/data";
import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { putTicket, ticketsCollection } from "../data/collections";
import { TICKETS_DIR, ticketFilesDir, ticketMarkdownPath, ticketToMarkdown } from "../data/draft-storage";
import { IDENTITY_MIGRATION, identityMigrations } from "../data/ticket-identity";
import { ticketResourceReference } from "../data/ticket-resource-hierarchy";

const BACKUP_ROOT = ".pstdio/ticket-identity-migration";

export const migrateTicketIdentitiesCommand = defineCommand({
  id: "migrate-ticket-identities",
  title: l10n("commands.migrateTicketIdentities", "Migrate ticket identities"),
  mutating: true,
  cli: true,
  params: {},
  async run(ctx) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const migrations = identityMigrations(ctx);
    const tickets = ticketsCollection(ctx.storage);
    let migration = await migrations.get(IDENTITY_MIGRATION);
    if (migration?.complete) return { migrated: 0, complete: true };
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
    // Keep the original checkout before replacing paths, including unsaved and orphaned files.
    for (const file of await repoFiles.list(`${TICKETS_DIR}/**`)) {
      const backup = `${BACKUP_ROOT}/${file.path}`;
      if (!(await repoFiles.exists(backup))) await repoFiles.writeBytes(backup, await repoFiles.readBytes(file.path));
    }
    const allocations = ctx.storage.collection<{ shorthand: string }>("ticket-identity-allocations");
    for (const ticket of migration.tickets) {
      if (!(await allocations.get(ticket.id))) {
        const identity = await ctx.resources.allocate({ kind: "ticket" });
        await allocations.createIfAbsent(ticket.id, { shorthand: identity.shorthand });
      }
    }
    for (const original of migration.tickets) {
      const ticket = await tickets.get(original.id);
      if (!ticket) throw new Error(`Ticket changed during migration: ${original.id}. Stop ticket writers and retry.`);
      const identity = (await allocations.get(ticket.id))!;
      await putTicket(ctx.storage, { ...ticket, shorthand: identity.shorthand });
    }
    // A project can reach the migration with no drafts checked out, and a resumed run
    // has already removed them, so only clear the directory when it is there.
    if (await repoFiles.exists(TICKETS_DIR)) await repoFiles.delete(TICKETS_DIR);
    const migrated = await tickets.list();
    const byId = new Map(migrated.map((ticket) => [ticket.id, ticket]));
    for (const ticket of migrated) {
      await repoFiles.writeText(ticketMarkdownPath(ticket.shorthand), await ticketToMarkdown(ctx.storage, ticket));
      for (const file of ticket.files ?? [])
        await repoFiles.writeText(`${ticketFilesDir(ticket.shorthand)}/${file.name}`, file.content);
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
      identities: migration.tickets.map((ticket) => ({
        id: ticket.id,
        previousShorthand: ticket.shorthand,
        shorthand: byId.get(ticket.id)!.shorthand,
      })),
      manualWorkspaceCleanup: workspaces.map((workspace) => ({
        id: workspace.id,
        shorthand: workspace.workspace_shorthand,
        branch: workspace.branch,
        path: workspace.worktree_path,
      })),
    };
  },
});
