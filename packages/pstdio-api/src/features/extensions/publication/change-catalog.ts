import type { ExtensionsRouteDeps } from "../deps";
import { activatePublishedSet } from "./activate";
import { openPublishedCatalog, publicationSchema } from "./catalog";
import { packageMetadataSchema } from "./types";

type CatalogChange =
  | { kind: "enabled"; extensionId: string; expectedRevision: string; enabled: boolean }
  | { kind: "rollback"; extensionId: string; expectedRevision: string; revision: string };

export const changePublishedCatalog = async (deps: ExtensionsRouteDeps, projectId: string, input: CatalogChange) => {
  const catalog = await openPublishedCatalog(deps, projectId);
  const record = await catalog.read(input.extensionId);
  const current = publicationSchema.parse(record.value);
  if (!record.asset) throw new Error("Published package is unavailable");
  if (input.expectedRevision !== record.revision)
    throw new Error("Published extension changed; read its revision again");
  let value = { ...current };
  if (input.kind === "enabled") {
    value.enabled = input.enabled;
  } else {
    const previous = await catalog.records.read(`package:${input.revision}`);
    if (!previous.asset || previous.deleted || !previous.value) throw new Error("Package revision not found");
    const metadata = packageMetadataSchema.parse(previous.value);
    if (metadata.extensionId !== input.extensionId || previous.asset.sha256 !== input.revision)
      throw new Error("Package belongs to another extension");
    value = { ...metadata, revision: input.revision, enabled: current.enabled };
  }
  return catalog.records.commit({
    operationId: crypto.randomUUID(),
    edits: [
      {
        recordId: input.extensionId,
        expectedRevision: record.revision,
        replace: { revision: value.revision, enabled: value.enabled },
      },
    ],
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
  const entries = (await catalog.list()).map((record) => ({
    publication: publicationSchema.parse(record.value),
    asset: record.asset!,
  }));
  const statuses = await activatePublishedSet(deps, projectId, entries, signal, extensionId);
  return { status: statuses[entries.findIndex((entry) => entry.publication.extensionId === extensionId)] };
};
