import type { ResourceRef } from "@pstdio/workbench";

export const workspaceMetadataString = (resource: ResourceRef | undefined, key: string) => {
  const value = resource?.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

export const workspaceIdOf = (resource: ResourceRef | undefined) =>
  workspaceMetadataString(resource, "workspaceId") ?? resource?.id;

export const workspaceFileResource = (resource: ResourceRef, path: string): ResourceRef => ({
  ...resource,
  metadata: {
    ...resource.metadata,
    workspaceView: "files",
    workspaceFilePath: path,
  },
});

export const workspaceDeleteResource = (
  resource: ResourceRef,
  path: string,
  type: "file" | "directory",
): ResourceRef => ({
  ...resource,
  metadata: {
    ...resource.metadata,
    workspaceDeletePath: path,
    workspaceDeleteType: type,
  },
});

export const workspaceRootResource = (resource: ResourceRef): ResourceRef => {
  const {
    workspaceDeletePath: _workspaceDeletePath,
    workspaceDeleteType: _workspaceDeleteType,
    workspaceFilePath: _workspaceFilePath,
    ...metadata
  } = resource.metadata ?? {};
  return { ...resource, metadata: { ...metadata, workspaceView: "files" } };
};

export const absoluteWorkspaceEntryPath = (resource: ResourceRef, path: string) => {
  const root = workspaceMetadataString(resource, "workspacePath")?.replace(/[/\\]+$/, "");
  if (!root) return undefined;
  const separator = root.includes("\\") && !root.includes("/") ? "\\" : "/";
  return `${root}${separator}${path.split("/").join(separator)}`;
};
