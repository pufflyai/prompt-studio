import { getFileTypeIcon, type SidebarNode } from "@pstdio/ui";
import { Folder } from "lucide-react";

interface FileEntry {
  path: string;
}

interface DirNode {
  name: string;
  path: string;
  children: Map<string, DirNode>;
  files: FileEntry[];
}

const createDir = (name: string, path: string): DirNode => ({
  name,
  path,
  children: new Map(),
  files: [],
});

const insertFile = (root: DirNode, file: FileEntry) => {
  const segments = file.path.split("/");
  const fileName = segments.pop() ?? file.path;

  let cursor = root;
  let cursorPath = "";

  for (const segment of segments) {
    cursorPath = cursorPath ? `${cursorPath}/${segment}` : segment;
    let next = cursor.children.get(segment);
    if (!next) {
      next = createDir(segment, cursorPath);
      cursor.children.set(segment, next);
    }
    cursor = next;
  }

  cursor.files.push({ ...file, path: fileName });
};

const compareEntries = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

const toSidebarNodes = (dir: DirNode, parentPath: string): SidebarNode[] => {
  const folderNodes: SidebarNode[] = [...dir.children.values()].sort(compareEntries).map((child) => ({
    id: `dir:${child.path}`,
    label: child.name,
    icon: <Folder size={14} />,
    children: toSidebarNodes(child, child.path),
  }));

  const fileNodes: SidebarNode[] = [...dir.files]
    .sort((a, b) => {
      if (parentPath === "" && a.path === "SKILL.md") return -1;
      if (parentPath === "" && b.path === "SKILL.md") return 1;
      return a.path.localeCompare(b.path);
    })
    .map((file) => {
      const fullPath = parentPath ? `${parentPath}/${file.path}` : file.path;
      const Icon = getFileTypeIcon(file.path);
      return {
        id: fullPath,
        label: file.path,
        icon: <Icon size={14} />,
        isNavigable: true,
      };
    });

  return [...folderNodes, ...fileNodes];
};

export const buildSkillFileTree = (files: FileEntry[]): SidebarNode[] => {
  const root = createDir("", "");
  for (const file of files) insertFile(root, file);
  return toSidebarNodes(root, "");
};

export const collectFolderIds = (nodes: SidebarNode[]): string[] => {
  const ids: string[] = [];
  const walk = (list: SidebarNode[]) => {
    for (const node of list) {
      if (node.children && node.children.length > 0) {
        ids.push(node.id);
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return ids;
};
