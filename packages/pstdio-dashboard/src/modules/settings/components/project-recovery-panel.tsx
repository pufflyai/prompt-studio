import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";
import { useProjectExtensions } from "@/shared/extensions/use-project-extensions";
import { ProjectRecoveryView } from "./project-recovery-view";

export const ProjectRecoveryPanel = (props: { projectId?: string }) => {
  const { projectId } = props;
  const extensions = useProjectExtensions(projectId);
  const points = useQuery({
    queryKey: ["project-recovery", projectId],
    enabled: !!projectId,
    queryFn: () => getApiClient().projects.recoveryPoints(projectId!),
  });
  if (!projectId) return null;
  return (
    <ProjectRecoveryView
      key={projectId}
      points={points.data ?? []}
      extensionNames={Object.fromEntries(
        (extensions.data?.extensions ?? []).map((extension) => [extension.extensionId, extension.displayName]),
      )}
      loading={points.isLoading}
      error={points.error?.message}
      onRefresh={() => void points.refetch()}
      onRestore={(input) => getApiClient().projects.restore(projectId, input)}
    />
  );
};
