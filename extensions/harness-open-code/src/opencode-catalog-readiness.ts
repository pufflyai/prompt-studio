import {
  buildHeaders,
  buildRequestUrl,
  OPENCODE_GET_TIMEOUT_MS,
  type OpencodeFetcher,
  requestJson,
  requireResponseOk,
} from "./opencode-http";
import { waitForNextPoll } from "./opencode-session-poller";

interface CatalogLocation {
  fetcher: OpencodeFetcher;
  baseUrl: string;
  directory: string;
  signal?: AbortSignal;
}

export const afterOpencodePlugins = async <T>(location: CatalogLocation, read: (signal: AbortSignal) => Promise<T>) => {
  const deadline = AbortSignal.timeout(OPENCODE_GET_TIMEOUT_MS);
  const signal = location.signal ? AbortSignal.any([deadline, location.signal]) : deadline;
  const url = buildRequestUrl(location.baseUrl, "/api/plugin", location.directory);
  const headers = buildHeaders(location.directory);

  // OpenCode can answer before activating a directory. The plugin inventory is its
  // documented readiness check for one-shot catalog clients.
  for (;;) {
    const { response, parsed } = await requestJson<{ data: unknown[] }>(location.fetcher, url, {
      method: "GET",
      headers,
      signal,
    });
    requireResponseOk(response, "", "OpenCode plugin inventory could not be read");
    if (Array.isArray(parsed?.data) && parsed.data.length > 0) return read(signal);
    await waitForNextPoll(signal, 100);
  }
};
