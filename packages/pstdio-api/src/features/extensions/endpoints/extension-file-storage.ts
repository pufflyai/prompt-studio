import type { ExtensionsRouteDeps } from "../deps";

const MAX_EXTENSION_FILE_UPLOAD_BYTES = 25 * 1024 * 1024;

type FileRow = NonNullable<Awaited<ReturnType<ExtensionsRouteDeps["extensionFileService"]["getOwnedFile"]>>>;

export const resolveExtensionFileScope = (projectId: string, query: { scope_type?: string; scope_id?: string }) => {
  const scopeType = query.scope_type ?? "project";
  return {
    scope_type: scopeType,
    scope_id: query.scope_id ?? (scopeType === "project" ? projectId : null),
  };
};

const fileUrl = (projectId: string, extensionInstanceId: string, fileId: string) =>
  `/v1/projects/${encodeURIComponent(projectId)}/extensions/${encodeURIComponent(extensionInstanceId)}/files/${encodeURIComponent(fileId)}/content`;

export const toExtensionBlobRef = (projectId: string, extensionInstanceId: string, file: FileRow) => ({
  id: file.id,
  name: file.file_name,
  mimeType: file.mime_type,
  size: file.size_bytes,
  hash: file.hash,
  url: fileUrl(projectId, extensionInstanceId, file.id),
  createdAt: file.created_at,
  updatedAt: file.updated_at,
});

const readUploadName = (headers: Headers) => {
  const name = headers.get("x-file-name")?.trim();
  if (!name) return "attachment";
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

export const readExtensionFileUpload = async (request: { arrayBuffer: () => Promise<ArrayBuffer> }) => {
  const data = Buffer.from(await request.arrayBuffer());
  return data.byteLength > MAX_EXTENSION_FILE_UPLOAD_BYTES ? null : data;
};

export const storeExtensionFile = (
  deps: ExtensionsRouteDeps,
  input: {
    data: Buffer;
    extensionInstanceId: string;
    headers: Headers;
    projectId: string;
    scopeId: string | null;
    scopeType: string;
  },
) =>
  deps.extensionFileService.upload({
    project_id: input.projectId,
    extension_instance_id: input.extensionInstanceId,
    scope_type: input.scopeType,
    scope_id: input.scopeId,
    file_name: readUploadName(input.headers),
    data: input.data,
    mime_type: input.headers.get("content-type"),
  });
