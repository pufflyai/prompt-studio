import { PstdioApiError } from "@pstdio/sdk/client";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useQueries, useQuery } from "@tanstack/react-query";
import { apiClientOptions, buildApiUrl } from "./api";
import { safeApiFileBlob } from "./api-file-blob";

export const API_FILE_URL_QUERY_KEY = "api-file-url";

// An <img> or a plain link cannot send the browser session header. So the dashboard fetches
// files it shows from the API with the header and shows them as blob URLs (ADR 0057).
const isApiFilePath = (url: string) => url.startsWith("/v1/");

const apiFileUrlQuery = (url: string) => ({
  queryKey: [API_FILE_URL_QUERY_KEY, url],
  queryFn: async () => {
    const { token } = apiClientOptions();
    const response = await fetch(buildApiUrl(url), { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new PstdioApiError(`Request failed: ${response.status}`, response.status);
    return URL.createObjectURL(safeApiFileBlob(await response.blob()));
  },
  staleTime: Number.POSITIVE_INFINITY,
});

/** Returns a URL an <img> can load. API files resolve to a blob URL, other URLs stay as they are. */
export const useApiFileUrl = (url: string) => {
  const apiFile = isApiFilePath(url);
  const { data } = useQuery({ ...apiFileUrlQuery(url), enabled: apiFile });
  return apiFile ? data : url;
};

const apiFileUrlsIn = (messages: SessionMessage[]) => [
  ...new Set(
    messages.flatMap((message) =>
      message.parts.flatMap((part) => (part.type === "file" && isApiFilePath(part.url) ? [part.url] : [])),
    ),
  ),
];

/** Resolves API file parts to blob URLs, so the chat can show and open them. */
export const useApiFileParts = (messages: SessionMessage[]) => {
  const urls = apiFileUrlsIn(messages);
  const resolved = useQueries({
    queries: urls.map(apiFileUrlQuery),
    combine: (results) => results.map((result) => result.data),
  });
  if (urls.length === 0) return messages;

  const blobUrls = new Map(urls.map((url, index) => [url, resolved[index] ?? ""]));
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) =>
      part.type === "file" && blobUrls.has(part.url) ? { ...part, url: blobUrls.get(part.url) ?? "" } : part,
    ),
  }));
};
