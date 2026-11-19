import { createHash } from "node:crypto";
import type { ChangeHead } from "pstdio-api-contracts";
import { resourceKey } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionsRouteDeps } from "../extensions/deps";

export const seenOwnerId = (login?: { managerOrigin: string; accountId: string } | null) =>
  JSON.stringify(["pstdio", "resource-seen", login?.managerOrigin ?? null, login?.accountId ?? null]);

const recordId = (head: ChangeHead, provider: string) =>
  createHash("sha256")
    .update(JSON.stringify([resourceKey(head.resource), provider, head.stamp.lineage]))
    .digest("hex");

const highest = (value: unknown) => {
  let result: bigint | undefined;
  for (const revision of Object.values(value ?? {})) {
    if (typeof revision !== "string" || !/^(0|[1-9][0-9]{0,39})$/.test(revision)) continue;
    const n = BigInt(revision);
    if (result === undefined || n > result) result = n;
  }
  return result;
};

export const openSeenStore = async (deps: ExtensionsRouteDeps, projectId: string) => {
  return seenStoreFor(deps, projectId, seenOwnerId((await deps.accountService.status()).login));
};

export const seenStoreFor = async (
  deps: Pick<ExtensionsRouteDeps, "extensionStorageService" | "environmentService">,
  projectId: string,
  principal: string,
) => {
  const owner = { workbenchId: projectId, extensionId: principal };
  const { records } = await deps.extensionStorageService.open({ owner });
  return {
    principal,
    async query(heads: (ChangeHead & { provider: string })[]) {
      const rows = await records.readMany(heads.map((head) => recordId(head, head.provider)));
      const seen = new Map(rows.map((row) => [row.recordId, highest(row.value)]));
      return heads.map(({ resource, stamp, provider }) => {
        const previous = seen.get(recordId({ resource, stamp }, provider));
        return { resource, stamp, changedSinceSeen: previous !== undefined && BigInt(stamp.revision) > previous };
      });
    },
    async acknowledge(head: ChangeHead, provider: string) {
      const id = recordId(head, provider);
      const { environmentId } = await deps.environmentService.get();
      await records.transaction(async (locked) => {
        const row = await locked.read(id);
        const previous = highest(row.value);
        if (previous !== undefined && previous >= BigInt(head.stamp.revision)) return;
        // One scalar per device preserves concurrent acknowledgements in the record merge.
        await locked.commit({
          operationId: crypto.randomUUID(),
          edits: [
            {
              recordId: id,
              set: { [`/${environmentId}`]: head.stamp.revision },
            },
          ],
        });
      });
    },
  };
};
