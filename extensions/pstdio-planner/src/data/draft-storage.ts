import { resolve } from "node:path";
import { createDraftLayout, requireRepoFiles } from "@pstdio/sdk/data";
import type { ArtifactMount, ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { tagsCollection, ticketsCollection } from "./collections";
import { applyFrontmatter, buildTicketFrontmatter } from "./frontmatter";
import { normalizeTicketDependencies } from "./ticket-dependencies";
import type { StoredTicket } from "./types";

export const TICKETS_DIR = ".pstdio/tickets";

const layout = createDraftLayout(TICKETS_DIR, "ticket");
export const ticketDir = layout.directory;
export const ticketMarkdownPath = layout.markdown;
export const ticketFilesDir = layout.files;
export const ticketFilesPattern = (shorthand: string) => `${ticketFilesDir(shorthand)}/**`;

export const ensureTicketDraftsIgnored = async (projectFiles: ArtifactMount) => {
  const path = ".pstdio/.gitignore";
  const existing = (await projectFiles.exists(path)) ? await projectFiles.readText(path) : "";
  const lines = existing.split("\n").filter(Boolean);
  if (lines.includes("/tickets")) return;
  await projectFiles.writeText(path, `${[...lines, "/tickets"].join("\n")}\n`);
};

// Project file mount paths are relative to the default workspace; the basename relative to the files dir
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

export const writeTicketText = async (projectFiles: ArtifactMount, shorthand: string, content: string) => {
  await ensureTicketDraftsIgnored(projectFiles);
  await projectFiles.writeText(ticketMarkdownPath(shorthand), content);
};

export const writeTicketMarkdown = (projectFiles: ArtifactMount, ticket: StoredTicket, content: string) =>
  writeTicketText(projectFiles, ticket.shorthand, content);

export const readTicketMarkdown = async (projectFiles: ArtifactMount, shorthand: string) => {
  const path = ticketMarkdownPath(shorthand);
  if (!(await projectFiles.exists(path))) return null;
  return projectFiles.readText(path);
};

export const requireTicketDraftFiles = async (ctx: Pick<ExtensionContextBase, "projectFiles" | "workspaces">) => {
  const projectFiles = requireRepoFiles(ctx.projectFiles);
  const home = await ctx.workspaces.getDefault();
  if (home?.execution_kind !== "local" || !home.root_path) {
    throw new Error("Ticket drafts require a local project folder.");
  }
  const root = home.root_path;
  return { projectFiles, resolvePath: (path: string) => resolve(root, path) };
};
