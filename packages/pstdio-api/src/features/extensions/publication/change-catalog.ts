import type { ExtensionsRouteDeps } from "../deps";
import { activatePublication } from "./activate";
import { openPublishedCatalog, publicationSchema } from "./catalog";

type CatalogChange =
  | { kind: "enabled"; extensionId: string; expectedRevision: string; enabled: boolean }
  | { kind: "rollback"; extensionId: string; expectedRevision: string; revision: string };

export const changePublishedCatalog = async (deps: ExtensionsRouteDeps, projectId: string, input: CatalogChange) => {
  const catalog = await openPublishedCatalog(deps, projectId);
  const record = await catalog.records.read(input.extensionId);
  const current = publicationSchema.parse(record.value);
  if (!record.asset) throw new Error("Published package is unavailable");
  if (input.expectedRevision !== record.revision)
    throw new Error("Published extension changed; read its revision again");
  let value = { ...current };
  let asset = record.asset;
  if (input.kind === "enabled") {
    if (!current.automation) throw new Error("Personal extension enable choices remain local");
    value.enabled = input.enabled;
  } else {
    const receipts = Object.values((await catalog.readState()).accepted?.receipts ?? {});
    const previous = receipts
      .filter((receipt) => receipt.status === "accepted")
      .flatMap((receipt) => receipt.mutation.changes)
      .find((change) => change.recordId === input.extensionId && change.asset?.next?.sha256 === input.revision);
    if (!previous?.asset?.next || !previous.value) throw new Error("Accepted package revision not found");
    value = { ...publicationSchema.parse(previous.value.next), enabled: current.enabled };
    asset = previous.asset.next;
  }
  return catalog.records.commit({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: input.extensionId, expectedRevision: record.revision, replace: value, asset }],
  });
};

export const adoptPublishedExtension = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  extensionId: string,
  signal: AbortSignal,
) => {
  const catalog = await openPublishedCatalog(deps, projectId);
  const accepted = (await catalog.readState()).accepted?.records[extensionId];
  if (!accepted?.asset || accepted.deleted) throw new Error("Publication is not accepted by the relay yet");
  return {
    status: await activatePublication(
      deps,
      projectId,
      publicationSchema.parse(accepted.value),
      accepted.asset,
      signal,
      true,
    ),
  };
};
