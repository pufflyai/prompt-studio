type TemplateWithContent = {
  id: string;
  name: string;
  template_type: string;
  is_default: boolean;
  content: string;
};

export const getTemplate = async (baseUrl: string, projectId: string, name: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${projectId}/templates/${encodeURIComponent(name)}`);

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to get template: ${res.status}`);
  }

  return (await res.json()) as TemplateWithContent;
};
