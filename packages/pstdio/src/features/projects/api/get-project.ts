type Project = {
  id: string;
  name: string;
  shorthand: string;
  created_at: string;
  updated_at: string;
};

export const getProject = async (baseUrl: string, projectId: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${projectId}`);

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch project: ${res.status}`);
  }

  return (await res.json()) as Project;
};
