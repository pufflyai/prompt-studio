import { and, eq, sql } from "drizzle-orm";
import { project_extensions } from "../../db/schemas.pg";

export const projectExtensionId = (projectId: string, extensionRef: string) =>
  `project-extension:${JSON.stringify([projectId, extensionRef])}`;
export const parseProjectExtensionId = (id: string) => {
  if (!id.startsWith("project-extension:")) return null;
  try {
    const value = JSON.parse(id.slice("project-extension:".length)) as unknown;
    return Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === "string")
      ? { projectId: value[0] as string, extensionRef: value[1] as string }
      : null;
  } catch {
    return null;
  }
};
export const projectExtensionWhere = (id: string) => {
  const key = parseProjectExtensionId(id);
  return key
    ? and(eq(project_extensions.project_id, key.projectId), eq(project_extensions.extension_ref, key.extensionRef))
    : sql`false`;
};
// Preserve the public row shape without storing a second identity or scope.
export const projectExtensionRow = (row: typeof project_extensions.$inferSelect) => {
  const { project_id, extension_ref, display_name, ...value } = row;
  return {
    ...value,
    id: projectExtensionId(project_id, extension_ref),
    installed_extension_id: extension_ref,
    scope_type: "project",
    scope_id: project_id,
    display_name_override: display_name,
  };
};
export type ExtensionInstanceRow = ReturnType<typeof projectExtensionRow>;
