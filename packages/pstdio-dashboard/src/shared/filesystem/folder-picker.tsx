import type { FilesystemDrive } from "@pstdio/sdk/client";
import { FolderPicker as FolderPickerUI } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { createDirectory, type DirectoryListResponse, listDirectory, listDrives } from "./file-system-api";

interface FolderPickerProps {
  onSelect: (path: string) => Promise<void>;
  onClose: () => void;
  isOpening?: boolean;
  error?: string;
}
export const FolderPicker = (props: FolderPickerProps) => {
  const [navigation, setNavigation] = useState({ path: "~" });
  const setPath = (path: string) => setNavigation({ path });
  const [listing, setListing] = useState<DirectoryListResponse>();
  const [drives, setDrives] = useState<FilesystemDrive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    listDrives()
      .then((result) => {
        if (!cancelled) setDrives(result.drives);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setListing(undefined);
    listDirectory(navigation.path)
      .then((result) => {
        if (!cancelled) setListing(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigation]);
  const currentPath = listing?.currentPath ?? (navigation.path === "~" ? "" : navigation.path);
  const createFolder = async (name: string) => {
    setError("");
    try {
      const result = await createDirectory(currentPath, name);
      setPath(result.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };
  return (
    <FolderPickerUI
      currentPath={currentPath}
      entries={listing?.entries ?? []}
      drives={drives}
      isUnavailable={!listing && !loading}
      isLoading={loading}
      isOpening={props.isOpening}
      error={error || props.error}
      onClose={props.onClose}
      onSelect={() => {
        void props.onSelect(currentPath);
      }}
      onNavigate={setPath}
      onCreateFolder={createFolder}
    />
  );
};
