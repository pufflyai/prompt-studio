import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

export const cloudAccountKey = ["cloud-account"];
export const cloudDevicesKey = ["cloud-devices"];
export const cloudProjectKey = ["cloud-project-sync"];

export const useCloudAccount = () =>
  useQuery({
    queryKey: cloudAccountKey,
    queryFn: () => getApiClient().account.status(),
    refetchInterval: 5_000,
  });

export const useCloudProject = (projectId?: string) =>
  useQuery({
    queryKey: [...cloudProjectKey, projectId],
    queryFn: () => getApiClient().account.projectSyncStatus(projectId!),
    enabled: !!projectId,
    refetchInterval: 1_000,
  });
