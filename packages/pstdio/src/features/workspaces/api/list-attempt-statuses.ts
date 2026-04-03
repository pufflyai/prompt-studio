type AttemptStatus = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export const listAttemptStatuses = async (baseUrl: string, projectId: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/attempt-statuses`);

  if (!res.ok) {
    throw new Error(`Failed to list attempt statuses: ${res.status}`);
  }

  return (await res.json()) as AttemptStatus[];
};
