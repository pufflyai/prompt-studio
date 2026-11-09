import { useScopedQueries, useScopedQuery } from "@pstdio/sdk/extensions/react";
import { useCloudContext } from "./cloud-context";
import { createCloudQueries } from "./cloud-queries";

export const useCloud = (projectId: string | undefined, includeDevices: boolean) => {
  const { client } = useCloudContext();
  const queries = createCloudQueries(client, projectId);
  const snapshot = useScopedQuery(queries.snapshot);
  const login = snapshot.data?.account.login;
  const deviceQuery = includeDevices && login ? queries.devices(login) : undefined;
  const devices = useScopedQueries(deviceQuery ? [deviceQuery] : [])[0];
  return {
    data: snapshot.data ? { ...snapshot.data, devices: devices?.data ?? [] } : undefined,
    error: snapshot.error?.message ?? devices?.error?.message,
    refresh: () => {
      queries.snapshot.invalidate();
      deviceQuery?.invalidate();
    },
  };
};
