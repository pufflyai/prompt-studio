import type { ReactNode } from "react";

export type ChangedFilesViewMode = "nested" | "flat";
export type DiffViewMode = "unified" | "split";

export interface ChangedFileTreeNode {
  id: string;
  name: string;
  type: "folder" | "file";
  children?: ChangedFileTreeNode[];
}

export interface FileIconInfo {
  icon: ReactNode;
  color: string;
}
