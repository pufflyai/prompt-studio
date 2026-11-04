import { useQuery } from "@tanstack/react-query";
import type { Session } from "pstdio-api-contracts";
import { useEffect, useEffectEvent, useState } from "react";
import { getApiClient } from "@/lib/api";
import { sessionDeviceAccess } from "../runtime/session-device-access";

export const useSessionDevice = (owner: Session["device"], queueReadOnly?: boolean, refreshQueue?: () => unknown) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState("this-device");
  const query = useQuery({
    queryKey: ["account-devices"],
    queryFn: () => getApiClient().account.devices(),
    refetchInterval: 15_000,
    retry: false,
  });
  const devices = query.data ?? [];
  const access = sessionDeviceAccess(owner, selectedDeviceId, query.data, queueReadOnly);
  const ownerOnline = access.remote && !access.connectionUnavailable;
  const refreshOnlineQueue = useEffectEvent(() => refreshQueue?.());
  useEffect(() => {
    if (!ownerOnline || !queueReadOnly) return;
    // A forwarded read fails while either device renews its relay access, and the retry can land in the same
    // window. Ask the online owner again after each read settles, backing off so a lasting failure stays cheap.
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = async (delay: number) => {
      await refreshOnlineQueue();
      if (stopped) return;
      timer = setTimeout(() => void attempt(Math.min(delay * 2, 30_000)), delay);
    };
    void attempt(2_000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [ownerOnline, queueReadOnly]);
  return {
    ...access,
    refresh: async () => {
      await query.refetch();
      await refreshQueue?.();
    },
    selectedDeviceId: owner?.id ?? selectedDeviceId,
    setSelectedDeviceId,
    devices: [
      { id: "this-device", name: "This device", current: true },
      ...devices.filter((device) => device.online && !device.current),
      ...(owner && !devices.some((device) => device.id === owner.id && device.online)
        ? [{ id: owner.id, name: owner.name }]
        : []),
    ],
  };
};
