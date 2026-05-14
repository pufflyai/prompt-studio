import { RepoPickerDialog as RepoPickerDialogUI } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type DirectoryEntry, listDirectory } from "@/features/file-system/data/api";
import { resolveFolderPickerDefaultPath, resolveParentPath } from "./folder-picker-default-path";

interface RepoPickerDialogProps {
  open: boolean;
  value?: string;
  title?: string;
  description?: string;
  selectedPaths?: string[];
  onClose: () => void;
  onSelect: (path: string | null) => void;
}

const isGitRepoFolder = (entries: DirectoryEntry[]) => entries.some((entry) => entry.name === ".git");

const isHiddenFolder = (entry: DirectoryEntry) => entry.name.startsWith(".");

const compareEntries = (left: DirectoryEntry, right: DirectoryEntry) =>
  left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
  left.path.localeCompare(right.path, undefined, { sensitivity: "base" });

const loadFolderDirectory = async (input: {
  path?: string;
  t: (key: string) => string;
  setIsLoading: (value: boolean) => void;
  setError: (value: string) => void;
  setSelectedPath: (value: string | null) => void;
  setSelectedIsGitRepo: (value: boolean) => void;
  setEntries: (value: DirectoryEntry[]) => void;
  setCurrentPath: (value: string) => void;
  setCurrentIsGitRepo: (value: boolean) => void;
}) => {
  const {
    path,
    t,
    setIsLoading,
    setError,
    setSelectedPath,
    setSelectedIsGitRepo,
    setEntries,
    setCurrentPath,
    setCurrentIsGitRepo,
  } = input;

  setIsLoading(true);
  setError("");
  setSelectedPath(null);
  setSelectedIsGitRepo(false);

  try {
    const result = await listDirectory(path);
    setEntries(result.entries);
    setCurrentPath(result.currentPath);
    setCurrentIsGitRepo(isGitRepoFolder(result.entries));
  } catch (loadError) {
    const message = loadError instanceof Error ? loadError.message : t("folderPicker.errors.unableToLoadDirectory");
    setError(message);
    setEntries([]);
    setCurrentIsGitRepo(false);
  } finally {
    setIsLoading(false);
  }
};

export const RepoPickerDialog = (props: RepoPickerDialogProps) => {
  const { open, value, title, description, selectedPaths = [], onClose, onSelect } = props;
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [currentIsGitRepo, setCurrentIsGitRepo] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedIsGitRepo, setSelectedIsGitRepo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let isCancelled = false;

    const loadInitialDirectory = async () => {
      if (value) {
        await loadFolderDirectory({
          path: value,
          t,
          setIsLoading,
          setError,
          setSelectedPath,
          setSelectedIsGitRepo,
          setEntries,
          setCurrentPath,
          setCurrentIsGitRepo,
        });
        return;
      }

      const defaultPath = await resolveFolderPickerDefaultPath(listDirectory);
      if (isCancelled) return;
      await loadFolderDirectory({
        path: defaultPath,
        t,
        setIsLoading,
        setError,
        setSelectedPath,
        setSelectedIsGitRepo,
        setEntries,
        setCurrentPath,
        setCurrentIsGitRepo,
      });
    };

    loadInitialDirectory().catch(() => {
      if (isCancelled) return;
      loadFolderDirectory({
        path: "~",
        t,
        setIsLoading,
        setError,
        setSelectedPath,
        setSelectedIsGitRepo,
        setEntries,
        setCurrentPath,
        setCurrentIsGitRepo,
      }).catch(() => undefined);
    });

    return () => {
      isCancelled = true;
    };
  }, [open, value, t]);

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
    loadFolderDirectory({
      path: entry.path,
      t,
      setIsLoading,
      setError,
      setSelectedPath,
      setSelectedIsGitRepo,
      setEntries,
      setCurrentPath,
      setCurrentIsGitRepo,
    }).catch(() => undefined);
  };

  const handleSelect = () => {
    const path = selectedPath ?? currentPath;
    const isGitRepo = selectedPath ? selectedIsGitRepo : currentIsGitRepo;

    if (!path) {
      setError(t("folderPicker.errors.pathRequired"));
      return;
    }

    if (selectedPaths.includes(path)) {
      setError(t("folderPicker.errors.repositoryAlreadySelected"));
      return;
    }

    if (!isGitRepo) {
      setError(t("folderPicker.errors.notGitRepository"));
      return;
    }

    onSelect(path);
    onClose();
  };

  const visibleEntries = entries.filter((entry) => !isHiddenFolder(entry)).sort(compareEntries);
  const canSelectPath = currentIsGitRepo || selectedPath !== null;

  return (
    <RepoPickerDialogUI
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
      onSelectHomeDirectory={() => {
        loadFolderDirectory({
          path: "~",
          t,
          setIsLoading,
          setError,
          setSelectedPath,
          setSelectedIsGitRepo,
          setEntries,
          setCurrentPath,
          setCurrentIsGitRepo,
        }).catch(() => undefined);
      }}
      onSelectParentDirectory={() => {
        if (currentPath) {
          loadFolderDirectory({
            path: resolveParentPath(currentPath),
            t,
            setIsLoading,
            setError,
            setSelectedPath,
            setSelectedIsGitRepo,
            setEntries,
            setCurrentPath,
            setCurrentIsGitRepo,
          }).catch(() => undefined);
        }
      }}
      onEntryClick={handleEntryClick}
    />
  );
};
