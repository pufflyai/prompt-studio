import { apiRequest } from "@/lib/api";

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isGitRepo: boolean;
}

export interface DirectoryListResponse {
  currentPath: string;
  entries: DirectoryEntry[];
}

export const listDirectory = async (path?: string) => {
  const trimmedPath = path?.trim();
  const query = trimmedPath ? `?path=${encodeURIComponent(trimmedPath)}` : "";

  return apiRequest<DirectoryListResponse>(`/v1/filesystem/list${query}`);
};
