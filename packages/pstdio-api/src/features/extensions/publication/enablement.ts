import type { ExtensionsRouteDeps } from "../deps";
import { openPublishedCatalog, publicationSchema } from "./catalog";

export class SharedExtensionEnablementError extends Error {
  constructor() {
    super(
      "This automation extension uses the workbench-wide publication switch. Use extensions publication enable or disable.",
    );
  }
}

export const sharedAutomationIds = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const catalog = await openPublishedCatalog(deps, projectId);
  const records = (await catalog.list()).filter((record) => !record.recordId.startsWith("package:"));
  return new Set(
    records
      .filter((record) => !record.deleted)
      .flatMap((record) => {
        const publication = publicationSchema.parse(record.value);
        return publication.automation ? [publication.extensionId] : [];
      }),
  );
};
