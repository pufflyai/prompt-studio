import { existsSync } from "node:fs";
import { waitForDefaultExtensionInstall } from "../default-extension-install-queue";
import type { ExtensionsRouteDeps } from "../deps";
import { packagedExtensionCatalog } from "../extension-catalog";
import type { activatePublishedSet } from "./activate";
import { publishedRevisionOf } from "./source";

export type IncludePublicationEntries = (entries: Parameters<typeof activatePublishedSet>[2]) => void;

/** The job owns the complete request; each attempt acquires its catalog and activation queue anew. */
export const runPublicationInstall = async <T>(
  deps: ExtensionsRouteDeps,
  projectId: string,
  entries: Parameters<typeof activatePublishedSet>[2],
  operation: (signal: AbortSignal, include: IncludePublicationEntries) => Promise<T>,
  signal?: AbortSignal,
  adopt: boolean | string = false,
) => {
  signal?.throwIfAborted();
  const installed = await deps.extensionService.listProjectExtensionInstances(projectId);
  const identities = (entries: Parameters<typeof activatePublishedSet>[2]) =>
    entries.flatMap(({ publication }) => {
      const source = installed.find(
        ({ installedSource }) => installedSource.extension_id === publication.extensionId,
      )?.installedSource;
      const adopting = adopt === true || adopt === publication.extensionId;
      if (
        !adopting &&
        source &&
        existsSync(source.source_path) &&
        publishedRevisionOf(source.source_ref) === publication.revision
      )
        return [];
      const catalog = packagedExtensionCatalog.extensions.find(
        (entry) => entry.extensionId === publication.extensionId,
      );
      return [
        {
          projectId,
          extensionId: publication.extensionId,
          installName: source?.install_name ?? catalog?.installName ?? publication.extensionId,
          displayName: source?.display_name ?? catalog?.displayName ?? publication.extensionId,
        },
      ];
    });
  return waitForDefaultExtensionInstall(
    deps.extensionInstallations.runGroup(
      identities(entries),
      (attemptSignal, include) => operation(attemptSignal, (entries) => include(identities(entries))),
      [`publication:${projectId}`],
    ),
    signal,
  );
};
