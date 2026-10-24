import { type ArtifactMount, defineCommand, type ExtensionStorageApi, params } from "@pstdio/sdk/extensions";
import { putTicket } from "../data/collections";
import {
  fileNameFromPath,
  readTicketMarkdown,
  requireTicketDraftFiles,
  ticketFilesPattern,
} from "../data/draft-storage";
import { parseTicketFrontmatter, stripFrontmatter } from "../data/frontmatter";
import {
  findTicket,
  resolveDependencyIds,
  resolveLinkedTicketId,
  resolveStatusId,
  resolveTagOptionIds,
} from "../data/resolve";
import { assertSingleSelectTagIds } from "../data/tag-cardinality";
import { refreshTicketCheckout } from "../data/ticket-checkout";
import { normalizeTicketDependencies, validateTicketDependencies } from "../data/ticket-dependencies";
import { validateTicketFileName } from "../data/ticket-file-name";
import type { TicketContext } from "../data/ticket-identity";
import { writeTicketImageCheckout } from "../data/ticket-image-checkout";
import { isImagePath, saveTicketImages } from "../data/ticket-images";
import type { StoredTicketFile, Ticket } from "../data/types";
import { deriveTitle } from "../utils/derive-title";

// Reads the local text files back into stored ticket files, preserving a
// file's id across saves when its name is unchanged.
const readTicketFiles = async (projectFiles: ArtifactMount, ticket: Ticket, paths: string[]) => {
  const now = new Date().toISOString();
  const previous = new Map((ticket.files ?? []).map((file) => [file.name, file]));

  return Promise.all(
    paths.map(async (path): Promise<StoredTicketFile> => {
      const name = validateTicketFileName(fileNameFromPath(ticket.shorthand, path));
      const content = await projectFiles.readText(path);
      const existing = previous.get(name);
      return existing
        ? { ...existing, content, updatedAt: now }
        : { id: crypto.randomUUID(), name, content, createdAt: now, updatedAt: now };
    }),
  );
};

const resolveTags = async (storage: ExtensionStorageApi, tagNames: string[] | undefined, fallback: string[]) =>
  tagNames === undefined ? fallback : resolveTagOptionIds(storage, tagNames);

const resolveDependencies = async (ctx: TicketContext, dependencyRefs: string[] | undefined, stored: string[]) =>
  dependencyRefs === undefined ? stored : resolveDependencyIds(ctx, dependencyRefs, stored);

// `pst tickets save`: reconcile the edited local ticket.md (body + frontmatter +
// files) back into extension storage and clear the draft flag.
export const saveTicketCommand = defineCommand({
  id: "save-ticket",
  mutating: true,
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
    const { projectFiles } = await requireTicketDraftFiles(ctx);
    const ticket = await findTicket(ctx, commandParams.id);
    if (!ticket) throw new Error(`Unknown ticket "${commandParams.id}"`);

    await refreshTicketCheckout(projectFiles, ticket);
    const raw = await readTicketMarkdown(projectFiles, ticket.shorthand);
    if (raw === null) throw new Error(`No local ticket file for ${ticket.shorthand}`);

    const frontmatter = parseTicketFrontmatter(raw);
    const content = stripFrontmatter(raw).replace(/^\n+/, "");

    const statusId =
      commandParams.status !== undefined ? await resolveStatusId(ctx.storage, commandParams.status) : ticket.statusId;
    const tagIds = await resolveTags(ctx.storage, frontmatter.tagNames, ticket.tagIds ?? []);
    await assertSingleSelectTagIds(ctx.storage, tagIds, ticket.tagIds);
    const dependsOn = await resolveDependencies(
      ctx,
      frontmatter.dependsOn,
      normalizeTicketDependencies(ticket.dependsOn),
    );
    if (frontmatter.dependsOn !== undefined) await validateTicketDependencies(ctx, ticket, dependsOn);
    const parentId =
      frontmatter.parentShorthand !== undefined
        ? await resolveLinkedTicketId(ctx, frontmatter.parentShorthand, ticket.parentId ? [ticket.parentId] : [])
        : ticket.parentId;
    const paths = (await projectFiles.list(ticketFilesPattern(ticket.shorthand))).map((entry) => entry.path);
    const files = await readTicketFiles(
      projectFiles,
      ticket,
      paths.filter((path) => !isImagePath(path)),
    );
    const images = await saveTicketImages(ctx.storage, projectFiles, ticket, paths.filter(isImagePath));

    const next: Ticket = {
      ...ticket,
      content,
      title: deriveTitle(content),
      statusId,
      tagIds,
      parentId,
      files,
      attachments: images.attachments,
      userPrompt: frontmatter.userPrompt ?? ticket.userPrompt ?? null,
      dependsOn,
      blockedReason: frontmatter.blockedReason ?? null,
      draft: false,
      updatedAt: new Date().toISOString(),
    };
    await putTicket(ctx, next);
    await writeTicketImageCheckout(projectFiles, ticket.shorthand, images.checkout);
    // Delete replaced images only after the ticket stops pointing at them.
    for (const id of images.replacedIds) await ctx.storage.files.delete(id);

    return { shorthand: ticket.shorthand, files: files.length };
  },
});
