import {
  buildHeaders,
  buildRequestUrl,
  isTransportTimeout,
  type OpencodeFetcher,
  requestJson,
  requireResponseOk,
} from "./opencode-http";
import type { WithServerUrl } from "./opencode-server";

export const waitForOpencodeIdle = async (input: {
  fetcher: OpencodeFetcher;
  withServerUrl: WithServerUrl;
  sessionId: string;
  directory: string;
  signal?: AbortSignal;
}) => {
  while (true) {
    input.signal?.throwIfAborted();
    try {
      // Recovery repeats only this read-only wait, never the accepted command or prompt.
      await input.withServerUrl(
        async (baseUrl) => {
          const result = await requestJson(
            input.fetcher,
            buildRequestUrl(baseUrl, `/api/experimental/session/${input.sessionId}/wait`, input.directory),
            {
              method: "POST",
              headers: buildHeaders(input.directory),
              signal: input.signal,
            },
          );
          requireResponseOk(result.response, result.text, "OpenCode session wait failed");
        },
        { retry: true },
      );
      return;
    } catch (error) {
      input.signal?.throwIfAborted();
      // Each request stays bounded; a transport deadline does not end native execution.
      if (!isTransportTimeout(error)) throw error;
    }
  }
};
