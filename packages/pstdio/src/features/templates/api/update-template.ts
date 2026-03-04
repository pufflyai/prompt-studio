type Template = {
  id: string;
  name: string;
  template_type: string;
  is_default: boolean;
};

type UpdateInput = {
  content?: string;
  is_default?: boolean;
};

export const updateTemplate = async (baseUrl: string, projectId: string, name: string, input: UpdateInput) => {
  const res = await fetch(`${baseUrl}/v1/projects/${projectId}/templates/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (res.status === 404) {
    throw new Error(`Template not found: ${name}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to update template: ${res.status}`);
  }

  return (await res.json()) as Template;
};
