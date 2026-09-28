import { findClosingFrontmatterDelimiter, quoteYamlScalar, unquoteYamlScalar } from "@pstdio/sdk/data";
import type { ArtifactMount, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { ticketDir, ticketFilesDir, ticketMarkdownPath, ticketToMarkdown } from "./draft-storage";
import { parseTicketFrontmatter } from "./frontmatter";
import type { StoredTicket } from "./types";

const updateDraftReferences = (content: string, shorthand: string, identities: Map<string, string>) => {
  const delimiter = content.startsWith("---") ? findClosingFrontmatterDelimiter(content) : null;
  if (!delimiter) return null;
  const resolve = (value: string) => identities.get(value.toUpperCase()) ?? value;
  const fields = parseTicketFrontmatter(content);
  const frontmatter = content
    .slice(0, delimiter.start)
    .replace(/^[\t ]*(ticket_id|parent_id|depends_on)[\t ]*:[^\n]*/gm, (line, key) => {
      if (key === "ticket_id") return `ticket_id: ${quoteYamlScalar(shorthand)}`;
      if (key === "parent_id")
        return `parent_id: ${quoteYamlScalar(resolve(unquoteYamlScalar(line.slice(line.indexOf(":") + 1).trim())))}`;
      return `depends_on: [${(fields.dependsOn ?? []).map((value) => quoteYamlScalar(resolve(value))).join(", ")}]`;
    });
  return frontmatter + content.slice(delimiter.start);
};

export const migrateTicketDraft = async (input: {
  projectFiles: ArtifactMount;
  storage: ExtensionStorageApi;
  backupRoot: string;
  previousShorthand: string;
  ticket: StoredTicket;
  identities: Map<string, string>;
}) => {
  const { projectFiles, storage, backupRoot, previousShorthand, ticket, identities } = input;
  const originalPath = `${backupRoot}/${ticketMarkdownPath(previousShorthand)}`;
  let content = await ticketToMarkdown(storage, ticket);
  if (await projectFiles.exists(originalPath)) {
    const original = await projectFiles.readText(originalPath);
    content =
      updateDraftReferences(original, ticket.shorthand, identities) ??
      (await ticketToMarkdown(storage, { ...ticket, content: original }));
  }
  await projectFiles.writeText(ticketMarkdownPath(ticket.shorthand), content);
  const originalDir = `${backupRoot}/${ticketDir(previousShorthand)}`;
  const files = await projectFiles.list(`${originalDir}/**`);
  if (files.length) {
    for (const file of files) {
      if (file.path === originalPath) continue;
      const target = `${ticketDir(ticket.shorthand)}${file.path.slice(originalDir.length)}`;
      await projectFiles.writeBytes(target, await projectFiles.readBytes(file.path));
    }
  } else {
    for (const file of ticket.files ?? []) {
      await projectFiles.writeText(`${ticketFilesDir(ticket.shorthand)}/${file.name}`, file.content);
    }
  }
};
