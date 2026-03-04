type Template = {
  id: string;
  name: string;
  template_type: string;
  is_default: boolean;
};

export const listTemplates = async (baseUrl: string, projectId: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${projectId}/templates`);

  if (!res.ok) {
    throw new Error(`Failed to list templates: ${res.status}`);
  }

  return (await res.json()) as Template[];
};
