import type { UpdateSettingsInput } from "@pstdio/sdk/api";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { getInstallationSettings } from "@/shared/settings/synced-settings";

export const useSettings = () => {
  const settings = getInstallationSettings();
  const data = useSyncExternalStore(settings.subscribe, settings.read, settings.read);
  const pending = useSyncExternalStore(settings.subscribe, settings.pending, settings.pending);
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: async ({ signal }) => {
      await settings.bootstrap(signal);
      return null;
    },
  });
  return { ...query, data, pending, isLoading: !data && query.isLoading };
};

type SettingsPanel = "beta-features" | "runtime";

const settingsSource = (panelId: SettingsPanel) => ({ id: WORKBENCH_SETTINGS_OPEN_COMMAND_ID, args: { panelId } });

export const useSettingsRecovery = (panelId: SettingsPanel) => {
  const settings = getInstallationSettings();
  const latest = () => settings.latestRecovery(settingsSource(panelId));
  const entry = useSyncExternalStore(settings.subscribe, latest, latest);
  return {
    entry,
    dismiss: () => {
      if (entry) settings.dismiss(entry.id);
    },
    check: entry?.canCheck ? () => settings.check(entry.id) : undefined,
  };
};

export const useUpdateSettings = (panelId: SettingsPanel) => {
  const settings = getInstallationSettings();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => settings.submit(input, settingsSource(panelId)).result,
  });
};
