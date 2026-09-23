import { apiRequest } from "@/lib/api";

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
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

export const createDirectory = (parent_path: string, name: string) =>
  apiRequest<{ path: string }>("/v1/filesystem/directories", { method: "POST", body: { parent_path, name } });
