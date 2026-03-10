import { useFetch } from "@/lib/use-fetch";
import { getChangelog } from "../data/api";

export const useChangelog = (projectId?: string) => useFetch(() => getChangelog(projectId), [projectId]);
