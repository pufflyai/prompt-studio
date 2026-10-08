import { QueryClient } from "@tanstack/react-query";
import { API_FILE_URL_QUERY_KEY } from "./api-file-url";

export const dashboardQueryClient = new QueryClient();

// A blob URL keeps its file in memory until it is revoked.
dashboardQueryClient.getQueryCache().subscribe((event) => {
  const data = event.query.state.data;
  if (event.type === "removed" && event.query.queryKey[0] === API_FILE_URL_QUERY_KEY && typeof data === "string") {
    URL.revokeObjectURL(data);
  }
});
