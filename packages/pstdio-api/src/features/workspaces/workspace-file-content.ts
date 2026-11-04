import type { createWorkspaceFilesMount, WorkspaceMountEntry } from "pstdio-extensions";

export const MAX_FILE_BYTES = 1024 * 1024;

const mimeTypesByExtension: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  css: "text/css",
  gif: "image/gif",
  htm: "text/html",
  html: "text/html",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript",
  json: "application/json",
  jsonc: "application/json",
  jsx: "text/javascript",
  md: "text/markdown",
  mjs: "text/javascript",
  png: "image/png",
  svg: "image/svg+xml",
  ts: "text/typescript",
  tsx: "text/typescript",
  txt: "text/plain",
  webp: "image/webp",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
};

export class UnsupportedWorkspaceFileError extends Error {}

export const fileNameOf = (path: string) => path.split("/").at(-1) ?? path;

const mimeTypeOf = (fileName: string) => {
  const extension = fileName.includes(".") ? (fileName.split(".").at(-1)?.toLocaleLowerCase() ?? "") : "";
  return mimeTypesByExtension[extension] ?? "text/plain";
};

const isImageMimeType = (mimeType: string) => mimeType.startsWith("image/");

const decodeText = (bytes: Uint8Array, path: string) => {
  if (bytes.includes(0)) throw new UnsupportedWorkspaceFileError(`Workspace file is not supported text: ${path}`);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new UnsupportedWorkspaceFileError(`Workspace file is not supported text: ${path}`);
  }
};

export const toApiEntry = (entry: WorkspaceMountEntry) => ({
  path: entry.path,
  name: entry.name,
  type: entry.type,
  ...(entry.size !== undefined ? { size: entry.size } : {}),
  ...(entry.modifiedAt ? { modified_at: entry.modifiedAt } : {}),
});

export const readWorkspaceFile = async (
  workspace: { id: string },
  mount: ReturnType<typeof createWorkspaceFilesMount>,
  path: string,
) => {
  const file = await mount.readFile(path, MAX_FILE_BYTES);
  const fileName = fileNameOf(path);
  const mimeType = mimeTypeOf(fileName);
  if (isImageMimeType(mimeType)) {
    const base64 = Buffer.from(file.bytes).toString("base64");
    return {
      workspace_id: workspace.id,
      path,
      file_name: fileName,
      mime_type: mimeType,
      size: file.size,
      encoding: "base64" as const,
      data_url: `data:${mimeType};base64,${base64}`,
      editable: false,
    };
  }
  return {
    workspace_id: workspace.id,
    path,
    file_name: fileName,
    mime_type: mimeType,
    size: file.size,
    encoding: "utf8" as const,
    content: decodeText(file.bytes, path),
    editable: true,
  };
};
