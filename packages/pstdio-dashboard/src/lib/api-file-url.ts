import { PstdioApiError } from "@pstdio/sdk/client";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { apiClientOptions } from "./api";
import { safeApiFileBlob } from "./api-file-blob";
import { createApiFilePartsResolver } from "./api-file-parts";

export const API_FILE_URL_QUERY_KEY = "api-file-url";

// An <img> or a plain link cannot send the browser session header. So the dashboard fetches
// files it shows from the API with the header and shows them as blob URLs (ADR 0057).
const isApiFilePath = (url: string) => url.startsWith("/v1/");

const apiFileUrlQuery = (url: string) => {
  const { baseUrl, token } = apiClientOptions();
  return {
    queryKey: [API_FILE_URL_QUERY_KEY, url],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const response = await fetch(`${baseUrl}${url}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        signal,
      });
      if (!response.ok) throw new PstdioApiError(`Request failed: ${response.status}`, response.status);
      const blob = await response.blob();
      signal.throwIfAborted();
      return URL.createObjectURL(safeApiFileBlob(blob));
    },
    staleTime: Number.POSITIVE_INFINITY,
  };
};

const apiFileUrlsIn = (messages: SessionMessage[], allowed: (url: string) => boolean) => [
  ...new Set(
    messages.flatMap((message) =>
      message.parts.flatMap((part) =>
        part.type === "file" && isApiFilePath(part.url) && allowed(part.url) ? [part.url] : [],
      ),
    ),
  ),
];

/** Resolves API file parts to blob URLs, so the chat can show and open them. */
export const useApiFileParts = (messages: SessionMessage[], allowed: (url: string) => boolean = () => true) => {
  const [resolveParts] = useState(createApiFilePartsResolver);
  const urls = apiFileUrlsIn(messages, allowed);
  const blobUrls = useApiFileUrls(urls);
  return resolveParts(messages, blobUrls);
};

/** Resolve an already scoped set of API file URLs with the existing authenticated cache. */
export const useApiFileUrls = (urls: string[]) => {
  const resolved = useQueries({
    queries: urls.map(apiFileUrlQuery),
    combine: (results) => results.map((result) => result.data),
  });
  return new Map(urls.map((url, index) => [url, resolved[index] ?? ""]));
};
