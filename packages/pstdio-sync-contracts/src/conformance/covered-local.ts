import { fingerprint } from "../fingerprint";
import { coveredAssetClosure } from "../retention";
import type { Asset } from "../wire";
import { type CoveredState, publicCoveredSnapshot } from "./covered-state";

export interface InstalledCoverage {
  snapshot: CoveredState;
  blobs: { asset: Asset; bytes: string }[];
  branches: string[];
}

/** Preserve an explicit proposal; old CRDT identifiers never become new-generation writes. */
export async function reconcileCoveredLocal(local: InstalledCoverage, remote: CoveredState) {
  const source = publicCoveredSnapshot(local.snapshot);
  const target = publicCoveredSnapshot(remote);
  const hasBranches = source.retainedBranches.length > 0 || local.branches.length > 0;
  if (!hasBranches && (await fingerprint(source.records)) === (await fingerprint(target.records)))
    return { status: "current" as const };
  const required = coveredAssetClosure(source, [...new Set([...source.retainedBranches, ...local.branches])]);
  const missing = required.filter((asset) => {
    const blob = local.blobs.find((blob) => blob.asset.sha256 === asset.sha256);
    if (!blob) return true;
    const bytes = Buffer.from(blob.bytes, "base64");
    return (
      bytes.byteLength !== asset.byteLength ||
      new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== asset.sha256
    );
  });
  return {
    status: missing.length ? ("recovery-unavailable" as const) : ("recovery-proposal" as const),
    source,
    target,
    missing,
    blobs: local.blobs,
  };
}
