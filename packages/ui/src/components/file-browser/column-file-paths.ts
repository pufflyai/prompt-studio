export interface ColumnFileItem {
  id: string;
  name: string;
  type: "file" | "folder";
  meta?: string;
  children?: ColumnFileItem[];
}

interface ColumnData<T extends ColumnFileItem> {
  items: T[];
  selectedFolderId?: string;
  breadcrumb: T[];
}

export const buildColumns = <T extends ColumnFileItem>(items: T[], selectedPath: string[]): ColumnData<T>[] => {
  const columns: ColumnData<T>[] = [];

  let currentItems = items;
  let breadcrumb: T[] = [];

  columns.push({
    items: currentItems,
    selectedFolderId: selectedPath[0],
    breadcrumb,
  });

  for (let index = 0; index < selectedPath.length; index++) {
    const folderId = selectedPath[index];
    const folder = currentItems.find((item) => item.id === folderId && item.type === "folder");

    if (!folder) break;

    breadcrumb = [...breadcrumb, folder];
    currentItems = (folder.children as T[] | undefined) ?? [];

    columns.push({
      items: currentItems,
      selectedFolderId: selectedPath[index + 1],
      breadcrumb,
    });
  }

  return columns;
};

export const findFirstFilePath = <T extends ColumnFileItem>(items: T[]) => {
  const stack: Array<{ item: T; path: T[] }> = [];

  for (let index = items.length - 1; index >= 0; index -= 1) {
    stack.push({ item: items[index] as T, path: [] });
  }

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current) break;

    const { item, path } = current;

    if (item.type === "file") {
      if (path.length === 0) continue;

      return { path, file: item };
    }

    const children = item.children as T[] | undefined;

    if (!children || children.length === 0) continue;

    const nextPath = [...path, item];

    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ item: children[index] as T, path: nextPath });
    }
  }

  return null;
};

export const buildFolderPathIds = <T extends ColumnFileItem>(path: T[]) => {
  return path.filter((item) => item.type === "folder").map((item) => item.id);
};

export const resolveActiveFileId = <T extends ColumnFileItem>(path: T[]) => {
  const lastItem = path[path.length - 1] ?? null;

  if (lastItem?.type !== "file") {
    return null;
  }

  return lastItem.id;
};

export const isSamePath = (nextPath: string[], currentPath: string[]) => {
  if (nextPath.length !== currentPath.length) return false;

  return nextPath.every((value, index) => value === currentPath[index]);
};
