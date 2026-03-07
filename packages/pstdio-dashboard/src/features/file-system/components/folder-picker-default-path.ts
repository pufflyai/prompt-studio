interface DirectoryEntry {
  name: string;
}

interface DirectorySnapshot {
  currentPath: string;
  entries: DirectoryEntry[];
}

type LoadDirectory = (path?: string) => Promise<DirectorySnapshot>;

const normalizePath = (value: string) => {
  const normalized = value.replace(/\\/g, "/").replace(/\/+$/g, "");
  return normalized || "/";
};

const hasGitMarker = (entries: DirectoryEntry[]) => entries.some((entry) => entry.name === ".git");

const isSamePath = (left: string, right: string) => normalizePath(left) === normalizePath(right);

export const resolveParentPath = (value: string) => {
  const normalizedPath = normalizePath(value);

  if (normalizedPath === "/") {
    return "/";
  }

  const segments = normalizedPath.split("/").filter(Boolean);

  if (segments.length <= 1) {
    return normalizedPath.startsWith("/") ? "/" : normalizedPath;
  }

  const parentSegments = segments.slice(0, -1).join("/");
  return normalizedPath.startsWith("/") ? `/${parentSegments}` : parentSegments;
};

export const resolveFolderPickerDefaultPath = async (loadDirectory: LoadDirectory) => {
  let current = await loadDirectory();

  while (true) {
    if (hasGitMarker(current.entries)) {
      const parentPath = resolveParentPath(current.currentPath);
      return isSamePath(parentPath, current.currentPath) ? "~" : parentPath;
    }

    const parentPath = resolveParentPath(current.currentPath);
    if (isSamePath(parentPath, current.currentPath)) {
      return "~";
    }

    current = await loadDirectory(parentPath);
  }
};
