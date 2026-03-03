type Project = {
  id: string;
  name: string;
  created_at: string;
};

export const listProjects = async (baseUrl: string) => {
  const res = await fetch(`${baseUrl}/v1/projects`);

  if (!res.ok) {
    throw new Error(`Failed to list projects: ${res.status}`);
  }

  return (await res.json()) as Project[];
};
