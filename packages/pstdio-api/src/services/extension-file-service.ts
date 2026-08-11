import type { createExtensionFilesDBService, createExtensionInstancesDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";
import type { createFileService } from "./file-service";

export type ExtensionFileServiceDeps = {
  eventBus: EventBus;
  extensionFilesDBService: ReturnType<typeof createExtensionFilesDBService>;
  extensionInstancesDBService: Pick<ReturnType<typeof createExtensionInstancesDBService>, "get">;
  fileService: Pick<ReturnType<typeof createFileService>, "upload" | "remove">;
};

interface ExtensionFileScope {
  project_id: string;
  extension_instance_id: string;
  scope_type: string;
  scope_id: string | null;
}

interface OwnedFileRef {
  project_id: string;
  extension_instance_id: string;
  file_id: string;
}

export const createExtensionFileService = (deps: ExtensionFileServiceDeps) => {
  const ownsProjectInstance = async (input: { project_id: string; extension_instance_id: string }) => {
    const instance = await deps.extensionInstancesDBService.get(input.extension_instance_id);
    return instance !== null && instance.scope_type === "project" && instance.scope_id === input.project_id;
  };

  const upload = async (input: ExtensionFileScope & { file_name: string; data: Buffer; mime_type?: string | null }) => {
    if (!(await ownsProjectInstance(input))) return null;

    const file = await deps.fileService.upload({
      project_id: input.project_id,
      file_name: input.file_name,
      file_kind: "extension",
      data: input.data,
      mime_type: input.mime_type ?? null,
    });
    await deps.extensionFilesDBService.attach({
      project_id: input.project_id,
      extension_instance_id: input.extension_instance_id,
      file_id: file.id,
      scope_type: input.scope_type,
      scope_id: input.scope_id,
    });
    deps.eventBus.emit("files", "set", file);

    return file;
  };

  const list = async (scope: ExtensionFileScope) => {
    if (!(await ownsProjectInstance(scope))) return null;
    return deps.extensionFilesDBService.list(scope);
  };

  const getOwnedFile = deps.extensionFilesDBService.getOwnedFile;

  const remove = async (input: OwnedFileRef) => {
    const file = await deps.extensionFilesDBService.getOwnedFile(input);
    if (!file) return false;

    await deps.extensionFilesDBService.detach(input);
    await deps.fileService.remove(input.file_id);
    deps.eventBus.emit("files", "delete", { id: input.file_id });

    return true;
  };

  return { upload, list, getOwnedFile, remove };
};
