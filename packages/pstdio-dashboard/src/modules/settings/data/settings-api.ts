import type { UpdateSettingsInput } from "@pstdio/sdk/api";
import { getApiClient } from "@/lib/api";
export const getSettings = () => getApiClient().settings.get();
export const updateSettings = (input: UpdateSettingsInput) => getApiClient().settings.update(input);
