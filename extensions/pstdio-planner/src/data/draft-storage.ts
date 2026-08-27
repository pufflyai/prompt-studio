import type { ArtifactMount, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { tagsCollection, ticketsCollection } from "./collections";
import { applyFrontmatter, buildTicketFrontmatter } from "./frontmatter";
import { normalizeTicketDependencies } from "./ticket-dependencies";
import type { StoredTicket } from "./types";

export const TICKETS_DIR = ".pstdio/tickets";

export const ticketDir = (shorthand: string) => `${TICKETS_DIR}/${shorthand}`;
export const ticketMarkdownPath = (shorthand: string) => `${ticketDir(shorthand)}/ticket.md`;
export const ticketFilesDir = (shorthand: string) => `${ticketDir(shorthand)}/files`;
export const ticketFilesPattern = (shorthand: string) => `${ticketFilesDir(shorthand)}/**`;

export const ensureTicketDraftsIgnored = async (repoFiles: ArtifactMount) => {
  const path = ".pstdio/.gitignore";
  const existing = (await repoFiles.exists(path)) ? await repoFiles.readText(path) : "";
  const lines = existing.split("\n").filter(Boolean);
  if (lines.includes("/tickets")) return;
  await repoFiles.writeText(path, `${[...lines, "/tickets"].join("\n")}\n`);
};

// repoFiles paths are repo-root relative; the basename relative to the files dir
// is the ticket file's name.
export const fileNameFromPath = (shorthand: string, path: string) => path.slice(`${ticketFilesDir(shorthand)}/`.length);

const tagNamesForIds = async (storage: ExtensionStorageApi, tagIds: string[]) => {
  if (tagIds.length === 0) return [];
  const options = (await tagsCollection(storage).list()).flatMap((tag) => tag.options);
  return tagIds.map((id) => options.find((option) => option.id === id)?.name).filter((name): name is string => !!name);
};

const parentShorthandForId = async (storage: ExtensionStorageApi, parentId: string | null | undefined) => {
  if (!parentId) return null;
  return (await ticketsCollection(storage).get(parentId))?.shorthand ?? parentId;
};

const dependencyShorthandsForIds = async (storage: ExtensionStorageApi, dependencyIds: string[]) =>
  Promise.all(dependencyIds.map(async (id) => (await ticketsCollection(storage).get(id))?.shorthand ?? id));

// Renders a stored ticket to its `.pstdio/tickets/<shorthand>/ticket.md` content:
// the YAML frontmatter (with tag ids resolved to names, parent id to shorthand)
// applied over the ticket body.
export const ticketToMarkdown = async (storage: ExtensionStorageApi, ticket: StoredTicket) => {
  const [tagNames, parentShorthand, dependencyShorthands] = await Promise.all([
    tagNamesForIds(storage, ticket.tagIds ?? []),
    parentShorthandForId(storage, ticket.parentId),
    dependencyShorthandsForIds(storage, normalizeTicketDependencies(ticket.dependsOn)),
  ]);

  const frontmatter = buildTicketFrontmatter({
    shorthand: ticket.shorthand,
    createdAt: ticket.createdAt,
    draft: ticket.draft ?? null,
    parentShorthand,
    userPrompt: ticket.userPrompt ?? null,
    dependsOn: dependencyShorthands,
    parallelizable: ticket.parallelizable ?? null,
    blockedReason: ticket.blockedReason ?? null,
    tagNames,
  });

  return applyFrontmatter(frontmatter, ticket.content);
};

export const writeTicketText = async (repoFiles: ArtifactMount, shorthand: string, content: string) => {
  await ensureTicketDraftsIgnored(repoFiles);
  await repoFiles.writeText(ticketMarkdownPath(shorthand), content);
};

export const writeTicketMarkdown = (repoFiles: ArtifactMount, ticket: StoredTicket, content: string) =>
  writeTicketText(repoFiles, ticket.shorthand, content);

export const readTicketMarkdown = async (repoFiles: ArtifactMount, shorthand: string) => {
  const path = ticketMarkdownPath(shorthand);
  if (!(await repoFiles.exists(path))) return null;
  return repoFiles.readText(path);
};

// repoFiles is only present for repo-scoped invocations (the CLI). Domain commands
// that touch the working tree fail loudly when invoked without it.
export const requireRepoFiles = (repoFiles: ArtifactMount | undefined): ArtifactMount => {
  if (!repoFiles) throw new Error("This command must be run inside a project repository.");
  return repoFiles;
};
