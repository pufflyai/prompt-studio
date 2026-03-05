export type DirectoryEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isGitRepo: boolean;
};

export type DirectoryListResponse = {
  currentPath: string;
  entries: DirectoryEntry[];
};

export const listDirectory = async (path?: string) => {
  const currentPath = path?.trim() || "~";

  return {
    currentPath,
    entries: [],
  } satisfies DirectoryListResponse;
};
