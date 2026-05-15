import type { SyncedRow } from "@/lib/sync";
import type { Project } from "../types";

export const toProject = (row: SyncedRow): Project => ({
  id: row.id,
  name: row.name as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

export const sortProjectsByUpdatedAt = (projects: Project[]) =>
  [...projects].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
