import type { ExtensionsRouteDeps } from "../deps";
import { activatePublishedSet } from "./activate";
import { openPublishedCatalog, publishedEntries } from "./catalog";
import { PublicationChangedError, packageMetadataSchema, selectionSchema } from "./types";

type CatalogChange =
  | { kind: "enabled"; extensionId: string; expectedRevision: string; enabled: boolean }
  | { kind: "rollback"; extensionId: string; expectedRevision: string; revision: string };
type Catalog = Awaited<ReturnType<typeof openPublishedCatalog>>;

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
export const changePublishedCatalog = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  input: CatalogChange,
  signal?: AbortSignal,
) => {
  const catalog = await openPublishedCatalog(deps, projectId);
  const proposed = await proposedEntry(catalog, input);
  const others = (await catalog.list()).filter((record) => record.recordId !== input.extensionId);
  await activatePublishedSet(deps, projectId, [...publishedEntries(others), proposed], signal, false, async () => {
    if ((await catalog.records.read(input.extensionId)).revision !== input.expectedRevision)
      throw new PublicationChangedError();
  });
  return catalog.change(input.extensionId, input.expectedRevision, ({ records }) =>
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

export const adoptPublishedExtension = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  extensionId: string,
  signal: AbortSignal,
) => {
  const catalog = await openPublishedCatalog(deps, projectId);
  const accepted = await catalog.read(extensionId);
  if (!accepted?.asset || accepted.deleted) throw new Error("Published package is unavailable");
  const entries = publishedEntries(await catalog.list());
  const statuses = await activatePublishedSet(deps, projectId, entries, signal, extensionId);
  return { status: statuses[entries.findIndex((entry) => entry.publication.extensionId === extensionId)] };
};
