import type { Settings, UpdateSettingsInput } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";

export const getSettings = () => apiRequest<Settings>("/v1/settings");

export const updateSettings = (input: UpdateSettingsInput) =>
  apiRequest<Settings>("/v1/settings", { method: "PATCH", body: input });
