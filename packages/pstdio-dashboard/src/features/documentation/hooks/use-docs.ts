import { useFetch } from "@/lib/use-fetch";
import { getDocsContent, getDocsIndex } from "../data/api";

export const useDocsIndex = (projectId?: string) => useFetch(() => getDocsIndex(projectId), [projectId]);

export const useDocsContent = (link: string | null, projectId?: string) =>
  useFetch(() => getDocsContent(link ?? "", projectId), [link, projectId], {
    enabled: Boolean(link),
  });
