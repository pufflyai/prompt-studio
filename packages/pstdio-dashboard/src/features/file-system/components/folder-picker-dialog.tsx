import { FolderPickerDialog as FolderPickerDialogUI } from "@pstdio/ui";
import { useCallback, useEffect, useState } from "react";
import { type DirectoryEntry, listDirectory } from "@/features/file-system/data/api";

interface FolderPickerDialogProps {
  open: boolean;
  value?: string;
  title?: string;
  description?: string;
  selectedPaths?: string[];
  onClose: () => void;
  onSelect: (path: string | null) => void;
}

const resolveParentPath = (value: string) => {
  const trimmed = value.replace(/\\/g, "/").replace(/\/+$/g, "");
  if (!trimmed) return "/";
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  return `/${parts.slice(0, -1).join("/")}`;
};

const isGitRepoFolder = (entries: DirectoryEntry[]) =>
  entries.some((entry) => entry.name === ".git" && entry.isDirectory);

const isHiddenFolder = (entry: DirectoryEntry) => entry.name.startsWith(".");

const compareEntries = (left: DirectoryEntry, right: DirectoryEntry) =>
  left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
  left.path.localeCompare(right.path, undefined, { sensitivity: "base" });

export const FolderPickerDialog = (props: FolderPickerDialogProps) => {
  const { open, value, title, description, selectedPaths = [], onClose, onSelect } = props;
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [currentIsGitRepo, setCurrentIsGitRepo] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedIsGitRepo, setSelectedIsGitRepo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDirectory = useCallback((path?: string) => {
    setIsLoading(true);
    setError("");
    setSelectedPath(null);
    setSelectedIsGitRepo(false);

    listDirectory(path)
      .then((result) => {
        setEntries(result.entries);
        setCurrentPath(result.currentPath);
        setCurrentIsGitRepo(isGitRepoFolder(result.entries));
      })
      .catch((loadError) => {
        const message = loadError instanceof Error ? loadError.message : "Unable to load directory";
        setError(message);
        setEntries([]);
        setCurrentIsGitRepo(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    loadDirectory(value);
  }, [open, value, loadDirectory]);

  const handleEntryClick = (entry: DirectoryEntry) => {
    if (!entry.isDirectory) return;
    if (entry.isGitRepo) {
      if (selectedPath === entry.path) {
        setSelectedPath(null);
        setSelectedIsGitRepo(false);
        setError("");
        return;
      }
      setSelectedPath(entry.path);
      setSelectedIsGitRepo(true);
      setError("");
      return;
    }
    loadDirectory(entry.path);
  };

  const handleSelect = () => {
    const path = selectedPath ?? currentPath;
    const isGitRepo = selectedPath ? selectedIsGitRepo : currentIsGitRepo;

    if (!path) {
      setError("Path is required.");
      return;
    }

    if (selectedPaths.includes(path)) {
      setError("Repository already selected.");
      return;
    }

    if (!isGitRepo) {
      setError("Selected folder is not a git repository.");
      return;
    }

    onSelect(path);
    onClose();
  };

  const visibleEntries = entries.filter((entry) => !isHiddenFolder(entry)).sort(compareEntries);
  const canSelectPath = currentIsGitRepo || selectedPath !== null;

  return (
    <FolderPickerDialogUI
      open={open}
      title={title}
      description={description}
      currentPath={currentPath}
      entries={visibleEntries}
      selectedPath={selectedPath}
      selectedPaths={selectedPaths}
      isLoading={isLoading}
      error={error}
      isSelectDisabled={isLoading || !canSelectPath}
      onClose={onClose}
      onSelect={handleSelect}
      onSelectHomeDirectory={() => loadDirectory("~")}
      onSelectParentDirectory={() => {
        if (currentPath) loadDirectory(resolveParentPath(currentPath));
      }}
      onEntryClick={handleEntryClick}
    />
  );
};
