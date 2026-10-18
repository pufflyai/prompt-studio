import { join } from "node:path";
import { assetSchema, fingerprint, type RelayOperation, relayAssetStatusSchema } from "pstdio-sync-contracts";
import type { RelayAssets } from "../types";
import { stageRelayPart, withRelaySpool } from "./asset-part";

type Request = (operation: RelayOperation, init?: RequestInit) => Promise<Response>;
const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const retainedPart = (
  prior: { sha256: string; byteLength: number } | undefined,
  sha256: string,
  byteLength: number,
) => {
  if (!prior) return false;
  if (prior.sha256 !== sha256 || prior.byteLength !== byteLength) throw new Error("Resumed asset part differs");
  return true;
};

export const createRelayAssetAdapter = (request: Request, signal: AbortSignal) =>
  ({
    async put(asset, source) {
      const uploadId = `asset:${await fingerprint(asset)}`;
      const status = relayAssetStatusSchema.parse(
        await (await request("assets/begin", json({ uploadId, asset }))).json(),
      );
      if (status.completed) return;
      await withRelaySpool(async (directory) => {
        const reader = (await source()).getReader();
        let pending: Uint8Array = new Uint8Array(0);
        const abort = () => {
          void reader.cancel(signal.reason).catch(() => {});
        };
        signal.addEventListener("abort", abort, { once: true });
        let total = 0;
        try {
          for (let number = 1; total < asset.byteLength; number++) {
            const path = join(directory, "part");
            const length = Math.min(status.partSize, asset.byteLength - total);
            const part = await stageRelayPart(reader, pending, length, path, signal);
            pending = part.pending;
            const sha256 = part.sha256;
            const prior = status.parts.find((part) => part.number === number);
            if (!retainedPart(prior, sha256, length)) {
              const response = await request("assets/part", {
                method: "PUT",
                headers: {
                  "x-pstdio-upload-id": uploadId,
                  "x-pstdio-part-number": String(number),
                  "x-pstdio-sha256": sha256,
                  "content-length": String(length),
                },
                body: Bun.file(path).stream(),
              });
              await response.body?.cancel();
            }
            total += length;
          }
          signal.throwIfAborted();
          if (pending.length || !(await reader.read()).done) throw new Error("Local asset exceeds its reference");
          const completed = assetSchema.parse(await (await request("assets/finish", json({ uploadId }))).json());
          if (JSON.stringify(completed) !== JSON.stringify(assetSchema.parse(asset)))
            throw new Error("Relay asset differs");
        } finally {
          signal.removeEventListener("abort", abort);
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
      });
    },
    async get(asset, offset, signal?: AbortSignal) {
      signal?.throwIfAborted();
      const response = await request("assets/read", { ...json({ asset, offset }), signal });
      if (response.status === 404) {
        await response.body?.cancel();
        return null;
      }
      if (
        !response.body ||
        response.headers.get("x-pstdio-offset") !== String(offset) ||
        response.headers.get("x-pstdio-byte-length") !== String(asset.byteLength - offset)
      ) {
        await response.body?.cancel();
        throw new Error("Invalid relay asset response");
      }
      return response.body;
    },
  }) satisfies RelayAssets;
