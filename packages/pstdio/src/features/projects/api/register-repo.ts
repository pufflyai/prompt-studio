type Repo = {
  id: string;
  name: string;
  path: string;
};

export const registerRepo = async (baseUrl: string, projectId: string, input: { name: string; path: string }) => {
  const res = await fetch(`${baseUrl}/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Failed to register repo: ${res.status}`);
  }

  return (await res.json()) as Repo;
};
