import type { Settings, UpdateSettingsInput } from "../api/settings";
import type { RequestFn, RequestOptions } from "./request";

type SettingsRequestOptions = Pick<RequestOptions, "signal">;

export type SettingsClient = {
  get(options?: SettingsRequestOptions): Promise<Settings>;
  update(input: UpdateSettingsInput, options?: SettingsRequestOptions): Promise<Settings>;
};

export const createSettingsClient = (request: RequestFn): SettingsClient => ({
  get: (options) => request("/v1/settings", options),
  update: (input, options) => request("/v1/settings", { ...options, method: "PATCH", body: input }),
});
