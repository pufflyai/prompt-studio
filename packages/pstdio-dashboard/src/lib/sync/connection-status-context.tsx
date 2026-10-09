import { createContext, useContext } from "react";
import { resolveDashboardStorage } from "@/shared/app/dashboard-storage";
import { createConnectionStatusSettings } from "./connection-status-settings";

export const ConnectionStatusSettingsContext = createContext(
  createConnectionStatusSettings(resolveDashboardStorage(undefined)),
);

export const useConnectionStatusSettings = () => useContext(ConnectionStatusSettingsContext);
