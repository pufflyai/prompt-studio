import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateSettingsInput } from "pstdio-api-contracts";
import { getSettings, updateSettings } from "../data/settings-api";

const queryKey = ["settings"] as const;

export const useSettings = () =>
  useQuery({
    queryKey,
    queryFn: getSettings,
  });

export const useUpdateSettings = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => updateSettings(input),
    onSuccess: (settings) => {
      client.setQueryData(queryKey, settings);
    },
  });
};
