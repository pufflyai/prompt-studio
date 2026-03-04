type Template = {
  id: string;
  name: string;
  template_type: string;
  is_default: boolean;
};

type CreateInput = {
  name: string;
  template_type: string;
  content: string;
  is_default?: boolean;
};

export const createTemplate = async (baseUrl: string, projectId: string, input: CreateInput) => {
  const res = await fetch(`${baseUrl}/v1/projects/${projectId}/templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (res.status === 409) {
    const body = (await res.json()) as { error: string };
    throw new Error(body.error);
  }

  if (!res.ok) {
    throw new Error(`Failed to create template: ${res.status}`);
  }

  return (await res.json()) as Template;
};
