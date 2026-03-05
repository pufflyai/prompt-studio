type Repo = {
  id: string;
  name: string;
  path: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export const listRepos = async (baseUrl: string, projectId: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/repos`);

  if (!res.ok) {
    throw new Error(`Failed to list repos: ${res.status}`);
  }

  return (await res.json()) as Repo[];
};
