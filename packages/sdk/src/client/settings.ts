import type { Settings, UpdateSettingsInput } from "../api/settings";
import type { RequestFn } from "./request";

export type SettingsClient = {
  get(): Promise<Settings>;
  update(input: UpdateSettingsInput): Promise<Settings>;
};

export const createSettingsClient = (request: RequestFn): SettingsClient => ({
  get: () => request("/v1/settings"),
  update: (input) => request("/v1/settings", { method: "PATCH", body: input }),
});
