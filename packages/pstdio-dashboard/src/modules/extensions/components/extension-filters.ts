import type { ExtensionAuthor } from "@pstdio/sdk/api";

export interface ExtensionFilters {
  search: string;
  author: string;
  scope: "all" | "repo" | "global";
}

export const defaultExtensionFilters: ExtensionFilters = { search: "", author: "all", scope: "all" };

export const extensionAuthorKey = (author: ExtensionAuthor | undefined) => {
  if (author?.kind === "self") return "me";
  if (author?.kind === "publisher") return `publisher:${author.publisher}`;
  return undefined;
};

export const matchesExtensionAuthor = (extension: { author?: ExtensionAuthor }, author: string) =>
  author === "all" || extensionAuthorKey(extension.author) === author;

export const matchesExtensionScope = (
  extension: { displayName: string; scope?: string },
  scope: ExtensionFilters["scope"],
) => scope === "all" || extension.scope === scope;

export const matchesExtensionSearch = (
  extension: { displayName: string; extensionId?: string; installName?: string; description?: string },
  search: string,
) => {
  const query = search.trim().toLowerCase();
  return [
    extension.displayName,
    extension.extensionId ?? "",
    extension.installName ?? "",
    extension.description ?? "",
  ].some((value) => value.toLowerCase().includes(query));
};
