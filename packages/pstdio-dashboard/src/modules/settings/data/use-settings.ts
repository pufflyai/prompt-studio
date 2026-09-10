import type { UpdateSettingsInput } from "@pstdio/sdk/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { subscribeCollections } from "@/lib/sync/collections";
import { readSettings, receiveSettings } from "@/shared/settings/synced-settings";
import { getSettings, updateSettings } from "./settings-api";

export const useSettings = () => {
  const data = useSyncExternalStore(subscribeCollections, readSettings, readSettings);
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const settings = await getSettings();
      if (!readSettings()) receiveSettings(settings);
      return null;
    },
  });
  return { ...query, data, isLoading: !data && query.isLoading };
};

export const useUpdateSettings = () =>
  useMutation({
    mutationFn: (input: UpdateSettingsInput) => updateSettings(input),
    onSuccess: receiveSettings,
  });
