import type { Asset } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../deps";
import { openPublishedCatalog, publishedOwner } from "./catalog";
import { packageFilesMatch, packExtension } from "./package";

export const publishedRevisionOf = (reference: string | null) =>
  reference?.startsWith("pstdio-published:") ? reference.slice("pstdio-published:".length) : null;

export const publishedSourceBaseline = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  reference: string | null,
  incoming: Asset,
) => {
  const revision = publishedRevisionOf(reference);
  if (!revision) return null;
  let asset: Asset | undefined = incoming.sha256 === revision ? incoming : undefined;
  if (!asset) {
    const state = await (await openPublishedCatalog(deps, projectId)).readState();
    asset = [
      ...Object.values(state.accepted?.records ?? {}).flatMap((record) => (record.asset ? [record.asset] : [])),
      ...Object.values(state.accepted?.receipts ?? {}).flatMap((receipt) =>
        receipt.mutation.changes.flatMap((change) => (change.asset?.next ? [change.asset.next] : [])),
      ),
      ...state.journal.flatMap((entry) =>
        entry.mutation.changes.flatMap((change) => (change.asset?.next ? [change.asset.next] : [])),
      ),
    ].find((candidate) => candidate.sha256 === revision);
  }
  if (!asset) return null;
  return new Response(await deps.assetTransferService.read(publishedOwner(projectId), asset)).blob();
};

export const sourceMatchesPublication = async (path: string, baseline: Blob | null) => {
  if (!baseline) return false;
  try {
    return await packageFilesMatch(await packExtension(path), baseline);
  } catch {
    // Files that cannot be represented as a published package still belong to
    // the local author. They must never be overwritten by automatic catch-up.
    return false;
  }
};
