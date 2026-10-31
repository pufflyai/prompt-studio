import { canonicalJson } from "pstdio-sync-contracts";
import { apiLogger } from "../../../lib/logger";
import type { ExtensionsRouteDeps } from "../deps";
import { activatePublishedSet } from "./activate";
import { openPublishedCatalog, publishedEntries } from "./catalog";
import { type IncludePublicationEntries, runPublicationInstall } from "./install-operation";
import { PublicationChangedError, packageMetadataSchema, selectionSchema } from "./types";

type CatalogChange =
  | { kind: "enabled"; extensionId: string; expectedRevision: string; enabled: boolean }
  | { kind: "rollback"; extensionId: string; expectedRevision: string; revision: string };
type Catalog = Awaited<ReturnType<typeof openPublishedCatalog>>;

class SharedSetChanged extends Error {}
// Each retry starts after a newer shared choice; a few cover choices that land while this one waits.
const sharedSetAttempts = 3;

/**
 * Runs the shared set on this device. The set is read before this waits its turn to activate, so it
 * is checked again right before switching: a newer shared choice is never undone by an older read.
 */
const followSharedSet = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  catalog: Catalog,
  signal?: AbortSignal,
  include?: IncludePublicationEntries,
) => {
  const current = async () =>
    canonicalJson((await catalog.list()).map((record) => ({ publication: record.value, asset: record.asset })));
  for (let attempt = 0; attempt < sharedSetAttempts; attempt++) {
    const entries = publishedEntries(await catalog.list());
    include?.(entries);
    try {
      await activatePublishedSet(deps, projectId, entries, signal, false, async () => {
        if ((await current()) !== canonicalJson(entries)) throw new SharedSetChanged();
      });
      return;
    } catch (error) {
      if (!(error instanceof SharedSetChanged)) throw error;
    }
  }
  throw new Error(`The shared extension set kept changing after ${sharedSetAttempts} attempts`);
};

const proposedEntry = async (catalog: Catalog, input: CatalogChange) => {
  const selected = await catalog.records.read(input.extensionId);
  if (selected.revision !== input.expectedRevision) throw new PublicationChangedError();
  // The raw selection keeps its enabled flag when its package is missing, so a rollback can repair it.
  const selection = selectionSchema.safeParse(selected.value);
  if (selected.deleted || !selection.success) throw new Error("Extension is not published");
  const revision = input.kind === "rollback" ? input.revision : selection.data.revision;
  const enabled = input.kind === "enabled" ? input.enabled : selection.data.enabled;
  const pkg = await catalog.records.read(`package:${revision}`);
  const metadata = packageMetadataSchema.safeParse(pkg.value);
  if (pkg.deleted || !metadata.success || !pkg.asset || pkg.asset.sha256 !== revision)
    throw new Error(`The published package ${revision} is unavailable`);
  if (metadata.data.extensionId !== input.extensionId) throw new Error("Package belongs to another extension");
  return { publication: { ...metadata.data, revision, enabled }, asset: pkg.asset };
};

/** This device runs the changed set before sharing it, so other devices never get a set it refused. */
const applyCatalogChange = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  input: CatalogChange,
  signal?: AbortSignal,
  include?: IncludePublicationEntries,
) => {
  const catalog = await openPublishedCatalog(deps, projectId);
  const proposed = await proposedEntry(catalog, input);
  const others = (await catalog.list()).filter((record) => record.recordId !== input.extensionId);
  const entries = [...publishedEntries(others), proposed];
  include?.(entries);
  await activatePublishedSet(deps, projectId, entries, signal, false, async () => {
    if ((await catalog.records.read(input.extensionId)).revision !== input.expectedRevision)
      throw new PublicationChangedError();
  });
  try {
    return await catalog.change(input.extensionId, input.expectedRevision, ({ records }) =>
      records.commit({
        operationId: crypto.randomUUID(),
        edits: [
          {
            recordId: input.extensionId,
            expectedRevision: input.expectedRevision,
            replace: { revision: proposed.publication.revision, enabled: proposed.publication.enabled },
          },
        ],
      }),
    );
  } catch (error) {
    // Activation needs the database, so it cannot run inside the catalog lock. When the shared save loses,
    // this device returns to the shared set itself, because a local project has no sync to repair it.
    // The caller still gets the conflict, even when returning to the shared set fails.
    await followSharedSet(deps, projectId, catalog, signal).catch((recovery) =>
      apiLogger.error(
        { event: "extension.publication.recovery_failed", projectId, extensionId: input.extensionId, err: recovery },
        "This device could not return to the shared extension set",
      ),
    );
    throw error;
  }
};

export const changePublishedCatalog = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  input: CatalogChange,
  signal?: AbortSignal,
) => {
  const catalog = await openPublishedCatalog(deps, projectId);
  const proposed = await proposedEntry(catalog, input);
  const others = (await catalog.list()).filter((record) => record.recordId !== input.extensionId);
  return runPublicationInstall(
    deps,
    projectId,
    [...publishedEntries(others), proposed],
    (attemptSignal, include) => applyCatalogChange(deps, projectId, input, attemptSignal, include),
    signal,
  );
};

export const synchronizePublishedExtensions = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  signal?: AbortSignal,
  onActivated?: () => void,
) => {
  const catalog = await openPublishedCatalog(deps, projectId);
  const entries = publishedEntries(await catalog.list());
  return runPublicationInstall(
    deps,
    projectId,
    entries,
    async (attemptSignal, include) => {
      await followSharedSet(
        deps,
        projectId,
        await openPublishedCatalog(deps, projectId, attemptSignal),
        attemptSignal,
        include,
      );
      onActivated?.();
    },
    signal,
  );
};

/** Shares an enabled state that this device already applied to its own copy. */
export const shareEnabledChoice = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  extensionId: string,
  enabled: boolean,
) => {
  const catalog = await openPublishedCatalog(deps, projectId);
  // The local choice does not depend on an observed revision, so it applies on top of the latest selection.
  await catalog.change(extensionId, undefined, async ({ read, records }) => {
    const current = await read(extensionId);
    if (!current.value) return;
    await records.commit({
      operationId: crypto.randomUUID(),
      edits: [
        {
          recordId: extensionId,
          expectedRevision: current.revision,
          replace: { revision: current.value.revision, enabled },
        },
      ],
    });
  });
};

/** Deletes the shared selection and returns an undo that never overwrites a newer shared choice. */
export const removeSharedSelection = async (catalog: Catalog, extensionId: string) => {
  const removed = await catalog.change(extensionId, undefined, async ({ records }) => {
    const current = await records.read(extensionId);
    if (!current.exists || current.deleted) return undefined;
    await records.commit({ operationId: crypto.randomUUID(), edits: [{ recordId: extensionId, deleted: true }] });
    return { value: current.value, revision: (await records.read(extensionId)).revision };
  });
  return async () => {
    if (!removed) return;
    await catalog
      .change(extensionId, removed.revision, ({ records }) =>
        records.commit({
          operationId: crypto.randomUUID(),
          edits: [
            { recordId: extensionId, expectedRevision: removed.revision, replace: removed.value, deleted: false },
          ],
        }),
      )
      .catch((error) => {
        if (!(error instanceof PublicationChangedError)) throw error;
      });
  };
};

const applyAdoption = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  extensionId: string,
  signal: AbortSignal,
  include?: IncludePublicationEntries,
) => {
  const catalog = await openPublishedCatalog(deps, projectId);
  const accepted = await catalog.read(extensionId);
  if (!accepted?.asset || accepted.deleted) throw new Error("Published package is unavailable");
  const entries = publishedEntries(await catalog.list());
  include?.(entries);
  const statuses = await activatePublishedSet(deps, projectId, entries, signal, extensionId);
  return { status: statuses[entries.findIndex((entry) => entry.publication.extensionId === extensionId)] };
};

export const adoptPublishedExtension = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  extensionId: string,
  signal: AbortSignal,
) => {
  const entries = publishedEntries(await (await openPublishedCatalog(deps, projectId)).list());
  return runPublicationInstall(
    deps,
    projectId,
    entries,
    (attemptSignal, include) => applyAdoption(deps, projectId, extensionId, attemptSignal, include),
    signal,
    extensionId,
  );
};
