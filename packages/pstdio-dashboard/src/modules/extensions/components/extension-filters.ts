export interface ExtensionFilters {
  search: string;
}

export const defaultExtensionFilters: ExtensionFilters = { search: "" };

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
