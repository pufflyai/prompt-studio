import { FolderPicker as FolderPickerUI } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { createDirectory, type DirectoryListResponse, listDirectory } from "./file-system-api";

interface FolderPickerProps {
  onSelect: (path: string) => Promise<void>;
  onClose: () => void;
  isOpening?: boolean;
  error?: string;
}
export const FolderPicker = (props: FolderPickerProps) => {
  const [navigation, setNavigation] = useState({ path: "~" });
  const setPath = (path: string) => setNavigation({ path });
  const [listing, setListing] = useState<DirectoryListResponse>({ currentPath: "", entries: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listDirectory(navigation.path)
      .then((result) => {
        if (!cancelled) setListing(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setListing({ currentPath: "", entries: [] });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigation]);
  const createFolder = async (name: string) => {
    setError("");
    try {
      const result = await createDirectory(listing.currentPath, name);
      setPath(result.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };
  return (
    <FolderPickerUI
      currentPath={listing.currentPath}
      entries={listing.entries}
      isLoading={loading}
      isOpening={props.isOpening}
      error={error || props.error}
      onClose={props.onClose}
      onSelect={() => {
        void props.onSelect(listing.currentPath);
      }}
      onNavigate={setPath}
      onCreateFolder={createFolder}
    />
  );
};
