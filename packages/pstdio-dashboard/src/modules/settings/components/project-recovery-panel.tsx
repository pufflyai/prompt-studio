import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";
import { useProjectExtensions } from "@/shared/extensions/use-project-extensions";
import { ProjectRecoveryView } from "./project-recovery-view";

export const ProjectRecoveryPanel = (props: { projectId?: string }) => {
  const { projectId } = props;
  const extensions = useProjectExtensions(projectId);
  const snapshots = useQuery({
    queryKey: ["project-recovery", projectId],
    enabled: !!projectId,
    queryFn: () => getApiClient().projects.snapshots(projectId!),
  });
  if (!projectId) return null;
  return (
    <ProjectRecoveryView
      key={projectId}
      snapshots={snapshots.data ?? []}
      extensionNames={Object.fromEntries(
        (extensions.data?.extensions ?? []).map((extension) => [extension.extensionId, extension.displayName]),
      )}
      loading={snapshots.isLoading}
      error={snapshots.error?.message}
      onRefresh={() => void snapshots.refetch()}
      onRestore={(input) => getApiClient().projects.restore(projectId, input)}
    />
  );
};
