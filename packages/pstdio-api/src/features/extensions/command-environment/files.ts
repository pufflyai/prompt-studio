import { readFile } from "node:fs/promises";
import { type CommandRunnerEnvironment, createReadBoundary } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

export const createFilesApi = (
  deps: ExtensionsRouteDeps,
  projectId: string,
  signal?: AbortSignal,
): CommandRunnerEnvironment["files"] => {
  const requireProjectFile = async (fileId: string) => {
    const file = await deps.fileService.get(fileId);
    if (!file || file.project_id !== projectId) throw new Error(`File not found: ${fileId}`);
    return file;
  };

  return {
    async readText(fileId) {
      const file = await createReadBoundary(signal)(() => requireProjectFile(fileId));
      return readFile(file.storage_path, { encoding: "utf8", signal });
    },
    async writeText(fileId, value) {
      await requireProjectFile(fileId);
      await deps.fileService.update(fileId, { data: Buffer.from(value, "utf8") });
    },
    async createText(input) {
      const file = await deps.fileService.upload({
        project_id: projectId,
        file_name: input.name,
        file_kind: "extension",
        data: Buffer.from(input.content, "utf8"),
        mime_type: "text/plain",
      });
      return { id: file.id };
    },
    async delete(fileId) {
      await requireProjectFile(fileId);
      await deps.fileService.remove(fileId);
    },
  };
};
