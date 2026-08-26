import { type ArtifactMount, defineCommand, type ExtensionStorageApi, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { fileNameFromPath, readTicketMarkdown, requireRepoFiles, ticketFilesPattern } from "../data/draft-storage";
import { parseTicketFrontmatter, stripFrontmatter } from "../data/frontmatter";
import { findTicket, resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import { normalizeTicketDependencies } from "../data/ticket-dependencies";
import type { StoredTicket, StoredTicketFile } from "../data/types";
import { deriveTitle } from "../utils/derive-title";

// Reads the local `files/` directory back into stored ticket files, preserving a
// file's id across saves when its name is unchanged.
const readTicketFiles = async (repoFiles: ArtifactMount, ticket: StoredTicket) => {
  const now = new Date().toISOString();
  const previous = new Map((ticket.files ?? []).map((file) => [file.name, file]));
  const entries = await repoFiles.list(ticketFilesPattern(ticket.shorthand));

  return Promise.all(
    entries.map(async (entry): Promise<StoredTicketFile> => {
      const name = fileNameFromPath(ticket.shorthand, entry.path);
      const content = await repoFiles.readText(entry.path);
      const existing = previous.get(name);
      return existing
        ? { ...existing, content, updatedAt: now }
        : { id: crypto.randomUUID(), name, content, createdAt: now, updatedAt: now };
    }),
  );
};

const resolveTags = async (storage: ExtensionStorageApi, tagNames: string[] | undefined, fallback: string[]) =>
  tagNames === undefined ? fallback : resolveTagOptionIds(storage, tagNames);

const resolveDependencyIds = async (
  storage: ExtensionStorageApi,
  dependencyRefs: string[] | undefined,
  fallback: string[],
) =>
  dependencyRefs === undefined ? fallback : Promise.all(dependencyRefs.map((ref) => resolveTicketId(storage, ref)));

// `pst tickets save`: reconcile the edited local ticket.md (body + frontmatter +
// files) back into extension storage and clear the draft flag.
export const saveTicketCommand = defineCommand({
  id: "save-ticket",
  title: "Save draft ticket",
  cli: {
    globalAliases: [["tickets", "save"]],
    examples: ["pstdio tickets save --id PS-1 --status 'In Progress'"],
  },
  params: {
    id: params.text({ required: true }),
    status: params.text(),
  },
  async run(ctx, commandParams) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const ticket = await findTicket(ctx.storage, commandParams.id);
    if (!ticket) throw new Error(`Unknown ticket "${commandParams.id}"`);

    const raw = await readTicketMarkdown(repoFiles, ticket.shorthand);
    if (raw === null) throw new Error(`No local ticket file for ${ticket.shorthand}`);

    const frontmatter = parseTicketFrontmatter(raw);
    const content = stripFrontmatter(raw).replace(/^\n+/, "");

    const statusId =
      commandParams.status !== undefined ? await resolveStatusId(ctx.storage, commandParams.status) : ticket.statusId;
    const tagIds = await resolveTags(ctx.storage, frontmatter.tagNames, ticket.tagIds ?? []);
    const dependsOn = await resolveDependencyIds(
      ctx.storage,
      frontmatter.dependsOn,
      normalizeTicketDependencies(ticket.dependsOn),
    );
    const parentId =
      frontmatter.parentShorthand !== undefined
        ? await resolveTicketId(ctx.storage, frontmatter.parentShorthand)
        : ticket.parentId;
    const files = await readTicketFiles(repoFiles, ticket);

    const next: StoredTicket = {
      ...ticket,
      content,
      title: deriveTitle(content),
      statusId,
      tagIds,
      parentId,
      files,
      userPrompt: frontmatter.userPrompt ?? ticket.userPrompt ?? null,
      dependsOn,
      parallelizable: frontmatter.parallelizable ?? ticket.parallelizable ?? null,
      blockedReason: frontmatter.blockedReason ?? null,
      draft: false,
      updatedAt: new Date().toISOString(),
    };
    await ticketsCollection(ctx.storage).put(ticket.id, next);

    return { shorthand: ticket.shorthand, files: files.length };
  },
});
