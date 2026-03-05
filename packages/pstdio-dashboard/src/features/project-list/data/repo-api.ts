import { apiRequest } from "@/lib/api";

export type RepoRecord = {
  id: string;
  name: string;
  displayName: string | null;
  path: string;
  createdAt: string;
  updatedAt: string;
};

type ApiRepo = {
  id: string;
  name: string;
  display_name: string | null;
  path: string;
  created_at: string;
  updated_at: string;
};

const toRepoRecord = (repo: ApiRepo): RepoRecord => ({
  id: repo.id,
  name: repo.name,
  displayName: repo.display_name,
  path: repo.path,
  createdAt: repo.created_at,
  updatedAt: repo.updated_at,
});

const resolveRepoName = (path: string, displayName?: string | null) => {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) {
    return trimmedDisplayName;
  }

  const normalizedPath = path.replaceAll("\\", "/").replace(/\/+$/g, "");
  const segments = normalizedPath.split("/").filter(Boolean);

  return segments.at(-1) ?? "repo";
};

export const registerRepo = async (projectId: string, input: { path: string; displayName?: string | null }) => {
  const repo = await apiRequest<ApiRepo>(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    body: {
      name: resolveRepoName(input.path, input.displayName),
      path: input.path,
    },
  });

  return toRepoRecord(repo);
};
