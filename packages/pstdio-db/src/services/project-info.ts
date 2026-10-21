import { coreOwnerId, type ProjectInfo, projectInfoDocumentId, readProjectInfo, writeProjectInfo } from "pstdio-sync";
import type { DbClient } from "../db/connection.pglite";
import { createDocumentStorageDBService } from "./extension-storage/document-storage";

/** The synced name and git remote of each project, owned by core like resource numbers. */
export const createProjectInfoDBService = (db: DbClient, documents = createDocumentStorageDBService(db)) => {
  const documentStore = documents.documents.open(projectInfoDocumentId);
  const owner = (projectId: string) => ({ workbenchId: projectId, extensionId: coreOwnerId });
  return {
    documentStore,
    read: (projectId: string) =>
      documentStore.transaction(owner(projectId), async ({ document }) => readProjectInfo(document)),
    write: (projectId: string, info: ProjectInfo) =>
      documentStore.transaction(owner(projectId), async ({ document }) => writeProjectInfo(document, info)),
    watchChanges: documents.watch,
  };
};
