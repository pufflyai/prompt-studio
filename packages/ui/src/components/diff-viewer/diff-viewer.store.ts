import { create } from "zustand";
import type { ChangedFilesViewMode, DiffViewMode } from "./types";

interface DiffViewerState {
  isTreePanelOpen: boolean;
  viewMode: ChangedFilesViewMode;
  diffViewMode: DiffViewMode;
  searchQuery: string;
  selectedPath: string | null;
  expandedFolderIds: Set<string>;
  setTreePanelOpen: (open: boolean) => void;
  toggleTreePanel: () => void;
  setViewMode: (viewMode: ChangedFilesViewMode) => void;
  setDiffViewMode: (diffViewMode: DiffViewMode) => void;
  setSearchQuery: (searchQuery: string) => void;
  setSelectedPath: (selectedPath: string | null) => void;
  setExpandedFolderIds: (folderIds: string[]) => void;
  toggleFolder: (folderId: string) => void;
  expandAll: (folderIds: string[]) => void;
  collapseAll: () => void;
}

export const useDiffViewerStore = create<DiffViewerState>((set) => ({
  isTreePanelOpen: true,
  viewMode: "nested",
  diffViewMode: "unified",
  searchQuery: "",
  selectedPath: null,
  expandedFolderIds: new Set(),
  setTreePanelOpen: (isTreePanelOpen) => set({ isTreePanelOpen }),
  toggleTreePanel: () => set((state) => ({ isTreePanelOpen: !state.isTreePanelOpen })),
  setViewMode: (viewMode) => set({ viewMode }),
  setDiffViewMode: (diffViewMode) => set({ diffViewMode }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedPath: (selectedPath) => set({ selectedPath }),
  setExpandedFolderIds: (folderIds) => set({ expandedFolderIds: new Set(folderIds) }),
  toggleFolder: (folderId) =>
    set((state) => {
      const expandedFolderIds = new Set(state.expandedFolderIds);
      if (expandedFolderIds.has(folderId)) expandedFolderIds.delete(folderId);
      else expandedFolderIds.add(folderId);
      return { expandedFolderIds };
    }),
  expandAll: (folderIds) => set({ expandedFolderIds: new Set(folderIds) }),
  collapseAll: () => set({ expandedFolderIds: new Set() }),
}));
