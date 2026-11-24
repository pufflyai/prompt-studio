import type { Settings } from "@pstdio/sdk/api";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { createSettingsOperations } from "./settings-operations";

export const readConfirmedSettings = (owner = getRuntimeCollections()) =>
  owner.getCollection("settings").state.get("global") as (Settings & { id: string }) | undefined;

export const receiveSettings = (settings: Settings, owner = getRuntimeCollections()) =>
  owner.getWriter("settings")!.upsert({ id: "global", ...settings });

export const getInstallationSettings = createRuntimeState((owner) => {
  const api = getRuntimeApiClient(owner).settings;
  const operations = createSettingsOperations({
    operations: getWorkbenchOperations(getDashboardScopedQueries(owner)),
    read: () => readConfirmedSettings(owner),
    accept: (settings) => receiveSettings(settings, owner),
    update: (input, signal) => api.update(input, { signal }),
    reload: (signal) => api.get({ signal }),
  });
  return {
    ...operations,
    async bootstrap(signal: AbortSignal) {
      const settings = await api.get({ signal });
      signal.throwIfAborted();
      if (!readConfirmedSettings(owner)) receiveSettings(settings, owner);
    },
    subscribe(listener: () => void) {
      const stopOperations = operations.subscribe(listener);
      const stopCollections = owner.subscribeCollections((change) => {
        if (!change || change.table === "settings") listener();
      });
      return () => {
        stopOperations();
        stopCollections();
      };
    },
  };
});

export const readSettings = () => getInstallationSettings().read();

export const notificationsEnabled = () => readSettings()?.notifications_enabled === true;

export const machineTokensEnabled = () => readConfirmedSettings()?.machine_tokens_enabled === true;
