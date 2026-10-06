import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { ProjectSetupStatus } from "@/shared/projects/project-setup-status";

interface StartSetupStatusProps {
  projectId: string;
  error: string;
}

// The synced workspace row clears or replaces the error once setup runs again.
export const StartSetupStatus = (props: StartSetupStatusProps) => {
  const { projectId, error } = props;
  const retry = useMutation({
    mutationFn: () => apiRequest(`/v1/projects/${projectId}/retry-setup`, { method: "POST" }),
  });

  return (
    <ProjectSetupStatus
      error={retry.error?.message ?? error}
      retrying={retry.isPending}
      onRetry={() => retry.mutate()}
    />
  );
};
