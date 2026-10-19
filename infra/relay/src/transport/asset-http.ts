import type { ReportFailure } from "pstdio-service-telemetry";
import {
  type RelayOperation,
  relayAssetBeginSchema,
  relayAssetPartSchema,
  relayAssetReadSchema,
  relayAssetStatusSchema,
  relayAssetUploadSchema,
  type Scope,
} from "pstdio-sync-contracts";
import type { RelayOwners } from "./owners";
import { relayResponse } from "./responses";

export const handleRelayAsset = async (
  owners: RelayOwners,
  scope: Scope,
  operation: RelayOperation,
  request: Request,
  body: unknown,
  report: ReportFailure,
) => {
  let action: () => Promise<Response>;
  try {
    if (operation === "assets/part") {
      const part = relayAssetPartSchema.parse({
        uploadId: decodeURIComponent(request.headers.get("x-pstdio-upload-id") ?? ""),
        number: Number(request.headers.get("x-pstdio-part-number")),
        sha256: request.headers.get("x-pstdio-sha256"),
        byteLength: Number(request.headers.get("content-length")),
      });
      if (!request.body || !request.headers.has("content-length")) throw new Error("Part body required");
      action = async () => {
        await owners.assets.writePart(scope, part.uploadId, part.number, {
          ...part,
          body: request.body!,
          signal: request.signal,
        });
        return relayResponse({});
      };
    } else if (operation === "assets/begin") {
      const intent = relayAssetBeginSchema.parse(body);
      action = async () => {
        const result = await owners.assets.begin(scope, intent.uploadId, intent.asset);
        return relayResponse(
          relayAssetStatusSchema.parse({
            ...result,
            parts: result.parts
              .filter((part) => part.etag !== null)
              .map(({ number, sha256, byteLength }) => ({ number, sha256, byteLength })),
          }),
        );
      };
    } else if (operation === "assets/read") {
      const { asset, offset } = relayAssetReadSchema.parse(body);
      action = async () => {
        const result = await owners.assets.read(scope, asset, offset, request.signal);
        if (!result) return relayResponse({ error: "Asset unavailable" }, 404);
        const headers = new Headers({
          "cache-control": "no-store",
          "content-type": asset.mediaType,
          "x-pstdio-offset": String(offset),
          "x-pstdio-byte-length": String(asset.byteLength - offset),
          "x-content-type-options": "nosniff",
        });
        return new Response(result.body, { status: 200, headers });
      };
    } else {
      const { uploadId } = relayAssetUploadSchema.parse(body);
      action = async () => {
        if (operation === "assets/finish") return relayResponse(await owners.assets.finish(scope, uploadId));
        await owners.assets.cancel(scope, uploadId);
        return relayResponse({});
      };
    }
  } catch {
    return relayResponse({ error: "Invalid asset request" }, 400);
  }
  try {
    // Cleanup of an existing scoped upload must not queue behind unrelated content work.
    if (operation !== "assets/cancel") await owners.storage.owner(scope).checkpoint(request.signal);
    return await action();
  } catch {
    if (!request.signal.aborted) report("asset_operation_failed");
    return relayResponse({ error: "Asset operation failed" }, 409);
  }
};
