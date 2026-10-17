import { join } from "node:path";
import type { Scope } from "pstdio-sync-contracts";

export type AssetBytesOwner = Pick<Scope, "workbenchId" | "extensionId">;

const segment = (value: string) => Buffer.from(value).toString("base64url");

export const assetBytePaths = (root: string, owner: AssetBytesOwner) => {
  const directory = join(root, "asset-bytes", segment(owner.workbenchId), segment(owner.extensionId));
  return {
    transfer: (operationId: string) => join(directory, "transfers", segment(operationId)),
    version: (sha256: string) => join(directory, "versions", segment(sha256)),
  };
};
