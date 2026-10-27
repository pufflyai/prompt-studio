import { type ArtifactMount, defineCommand, type ExtensionStorageApi, params } from "@pstdio/sdk/extensions";
import { changeTicketFiles } from "../data/collections";
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
import { ticketTagsForIds } from "../data/tag-cardinality";
import { refreshTicketCheckout } from "../data/ticket-checkout";
import { normalizeTicketDependencies, validateTicketDependencies } from "../data/ticket-dependencies";
import { readTicketFileContent, storeTicketFileContent } from "../data/ticket-file-content";
import { validateTicketFileName } from "../data/ticket-file-name";
import type { TicketContext } from "../data/ticket-identity";
import { writeTicketImageCheckout } from "../data/ticket-image-checkout";
import { isImagePath, saveTicketImages } from "../data/ticket-images";
import { ticketTagIds, withChangedTags } from "../data/ticket-tags";
import type { StoredTicketFile, Ticket } from "../data/types";
import { plannerTicketsChanged } from "../events";
import { deriveTitle } from "../utils/derive-title";

// Reads the local text files back into stored ticket files, preserving a file's id across
// saves when its name is unchanged. Existing files keep their blob identities.
const readTicketFiles = async (
  storage: ExtensionStorageApi,
  projectFiles: ArtifactMount,
  ticket: Ticket,
  paths: string[],
) => {
  const now = new Date().toISOString();
  const previous = new Map((ticket.files ?? []).map((file) => [file.name, file]));
  const files: StoredTicketFile[] = [];
  for (const path of paths) {
    const name = validateTicketFileName(fileNameFromPath(ticket.shorthand, path));
    const content = await projectFiles.readText(path);
    const existing = previous.get(name);
    if (existing && (await readTicketFileContent(storage, ticket.id, existing)) === content) {
      files.push(existing);
      continue;
    }
    const blobId = await storeTicketFileContent(storage, ticket.id, name, content, existing?.blobId);
    files.push(
      existing
        ? { ...existing, blobId, updatedAt: now }
        : { id: crypto.randomUUID(), name, blobId, createdAt: now, updatedAt: now },
    );
  }
  return files;
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
    const tagIds = await resolveTags(ctx.storage, frontmatter.tagNames, ticketTagIds(ticket));
    const tags = await ticketTagsForIds(ctx.storage, tagIds, ticket.tags);
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
    // Files and images compare against the stored ticket, so a change made during this save is not undone.
    const saved = await changeTicketFiles(ctx, ticket.id, async (stored) => {
      const images = await saveTicketImages(ctx.storage, projectFiles, stored, paths.filter(isImagePath));
      // The next save reads this mapping, so it is written in the ticket's queue with the images it names.
      await writeTicketImageCheckout(projectFiles, ticket.shorthand, images.checkout);
      return {
        ...stored,
        content,
        title: deriveTitle(content),
        statusId,
        tags: withChangedTags(stored.tags, ticket.tags, tags),
        parentId,
        files: await readTicketFiles(
          ctx.storage,
          projectFiles,
          stored,
          paths.filter((path) => !isImagePath(path)),
        ),
        attachments: images.attachments,
        userPrompt: frontmatter.userPrompt ?? stored.userPrompt ?? null,
        dependsOn,
        blockedReason: frontmatter.blockedReason ?? null,
        draft: false,
        updatedAt: new Date().toISOString(),
      };
    });

    await ctx.events.emit(plannerTicketsChanged, { ticketId: ticket.id });

    return { shorthand: ticket.shorthand, files: saved.files?.length ?? 0 };
  },
});
