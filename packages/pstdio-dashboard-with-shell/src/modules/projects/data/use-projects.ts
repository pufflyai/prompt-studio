import { asSyncedRows, getCollection, useLiveQuery } from "@/lib/sync";
import { sortProjectsByUpdatedAt, toProject } from "./project-mappers";

export const useProjects = () => {
  const { data: rawRows, isLoading } = useLiveQuery(
    (query) => query.from({ project: getCollection("projects") }).select(({ project }) => ({ ...project })),
    [],
  );
  const rows = asSyncedRows(rawRows);
  const projects = sortProjectsByUpdatedAt((rows ?? []).map(toProject));

  return { projects, isLoading };
};
