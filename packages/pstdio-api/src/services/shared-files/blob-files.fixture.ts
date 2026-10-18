import { join } from "node:path";
import {
  createExtensionFilesDBService,
  createExtensionInstancesDBService,
  createFilesDBService,
  createInstalledExtensionSourcesDBService,
} from "pstdio-db";
import { createFilesStorageService } from "pstdio-storage";
import { EventBus } from "../../features/sync/event-bus";
import { createExtensionFileService } from "../extension-file-service";
import { createFileService } from "../file-service";
import { artifactFilesFixture } from "./artifact-files.fixture";

export const blobFilesFixture = async () => {
  const f = await artifactFilesFixture();
  const instances = createExtensionInstancesDBService(f.db);
  const sources = createInstalledExtensionSourcesDBService(f.db);
  const source = await sources.register({
    install_name: "example-documents",
    extension_id: f.owner.extensionId,
    display_name: "Documents",
    source_kind: "local_path",
    source_path: join(f.root, "extension"),
  });
  const instance = await instances.create({
    installed_extension_id: source.id,
    scope_type: "project",
    scope_id: f.owner.workbenchId,
  });
  const extensionFilesDBService = createExtensionFilesDBService(f.db);
  const fileService = createFileService({
    filesDBService: createFilesDBService(f.db),
    filesStorageService: createFilesStorageService(join(f.root, "legacy")),
    eventBus: new EventBus(),
  });
  const fileDeps = {
    extensionFilesDBService,
    extensionInstancesDBService: instances,
    installedExtensionSourcesDBService: sources,
    fileService,
    ...f.deps,
  };
  const service = createExtensionFileService(fileDeps);
  const scope = {
    project_id: f.owner.workbenchId,
    extension_instance_id: instance.id,
    scope_type: "project",
    scope_id: f.owner.workbenchId,
  };
  return { ...f, service, scope, instances, sources, extensionFilesDBService, fileService, fileDeps };
};
