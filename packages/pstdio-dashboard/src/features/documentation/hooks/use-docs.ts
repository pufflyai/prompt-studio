import { useQuery } from "@tanstack/react-query";
import { getDocsContent, getDocsIndex } from "../data/api";

export const useDocsIndex = (projectId?: string) =>
  useQuery({
    queryKey: ["docs-index", projectId],
    queryFn: () => getDocsIndex(projectId),
  });

export const useDocsContent = (link: string | null, projectId?: string) =>
  useQuery({
    queryKey: ["docs-content", link, projectId],
    queryFn: () => getDocsContent(link ?? "", projectId),
    enabled: Boolean(link),
  });
