import { useQuery } from "@tanstack/react-query";
import { getDocsContent, getDocsIndex } from "../data/api";

const docsKeys = {
  index: (projectId?: string) => ["docs", "index", projectId ?? "global"] as const,
  content: (link: string | null, projectId?: string) => ["docs", "content", projectId ?? "global", link ?? ""] as const,
};

export const useDocsIndex = (projectId?: string) =>
  useQuery({
    queryKey: docsKeys.index(projectId),
    queryFn: () => getDocsIndex(projectId),
  });

export const useDocsContent = (link: string | null, projectId?: string) =>
  useQuery({
    queryKey: docsKeys.content(link, projectId),
    queryFn: () => getDocsContent(link ?? "", projectId),
    enabled: Boolean(link),
  });
