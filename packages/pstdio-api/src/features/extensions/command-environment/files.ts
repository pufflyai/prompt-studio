import { readFileSync } from "node:fs";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

export const createFilesApi = (deps: ExtensionsRouteDeps, projectId: string): CommandRunnerEnvironment["files"] => ({
  async readText(fileId) {
    const file = await deps.fileService.get(fileId);
    if (!file) throw new Error(`File not found: ${fileId}`);
    return readFileSync(file.storage_path, "utf8");
  },
  async writeText(fileId, value) {
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
    await deps.fileService.remove(fileId);
  },
});
