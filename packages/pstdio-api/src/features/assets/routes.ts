import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { assetReferenceSchema, assetTransferSchema } from "pstdio-api-contracts";
import { AssetIntegrityError } from "pstdio-storage";
import { AssetTransferError } from "../../services/asset-transfer-service";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";

type AssetsRouteDeps = Pick<RouteDeps, "assetTransferService" | "extensionService">;
const ownerParams = z.strictObject({ projectId: z.string().min(1), extensionInstanceId: z.string().min(1) });
const transferParams = ownerParams.extend({ operationId: z.string().min(1) });
const base = "/projects/{projectId}/extensions/{extensionInstanceId}";
const transferPath = `${base}/asset-transfers/{operationId}`;
const binary = { "application/octet-stream": { schema: z.string().openapi({ type: "string", format: "binary" }) } };
const json = { "application/json": { schema: assetTransferSchema } };
const errorContent = { "application/json": { schema: z.object({ error: z.string(), code: z.string() }) } };
const errors = {
  404: { description: "Owner, transfer, or complete asset not found.", content: errorContent },
  409: { description: "Operation identity, offset, or cancellation conflict.", content: errorContent },
  422: { description: "Asset integrity mismatch.", content: errorContent },
};

export const createAssetRoutes = (deps: AssetsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  const service = deps.assetTransferService;
  const withOwner = async <T>(
    c: Context<AppBindings>,
    params: z.infer<typeof ownerParams>,
    action: (owner: { workbenchId: string; extensionId: string }) => Promise<T>,
  ) => {
    const record = await deps.extensionService.getProjectExtensionInstance(
      params.projectId,
      params.extensionInstanceId,
    );
    if (!record) return c.json({ error: "Asset owner not found.", code: "ASSET_OWNER_NOT_FOUND" }, 404);
    try {
      return await action({ workbenchId: params.projectId, extensionId: record.installedSource.extension_id });
    } catch (error) {
      if (error instanceof AssetIntegrityError)
        return c.json({ error: error.message, code: "ASSET_INTEGRITY_MISMATCH" }, 422);
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return c.json({ error: "Complete asset not found.", code: "ASSET_NOT_FOUND" }, 404);
      if (!(error instanceof AssetTransferError)) throw error;
      let status: 404 | 409 | 422 = 409;
      if (error.code === "ASSET_TRANSFER_NOT_FOUND") status = 404;
      if (error.code === "ASSET_INTEGRITY_MISMATCH") status = 422;
      return c.json({ error: error.message, code: error.code }, status);
    }
  };
  const stateResponse = (c: Context<AppBindings>, state: Awaited<ReturnType<typeof service.get>>) =>
    state ? c.json(state, 200) : c.json({ error: "Transfer not found.", code: "ASSET_TRANSFER_NOT_FOUND" }, 404);

  routes.openapi(
    createRoute({
      method: "put",
      path: transferPath,
      tags: ["Assets"],
      request: {
        params: transferParams,
        body: { content: { "application/json": { schema: z.strictObject({ expected: assetReferenceSchema }) } } },
      },
      responses: { 200: { description: "Begin or resume an immutable upload operation.", content: json }, ...errors },
    }),
    async (c) => {
      const params = c.req.valid("param");
      return withOwner(c, params, async (owner) =>
        stateResponse(c, await service.begin(owner, params.operationId, c.req.valid("json").expected)),
      );
    },
  );
  routes.openapi(
    createRoute({
      method: "get",
      path: transferPath,
      tags: ["Assets"],
      request: { params: transferParams },
      responses: {
        200: { description: "Persisted transfer state and recoverable byte offset.", content: json },
        ...errors,
      },
    }),
    async (c) => {
      const params = c.req.valid("param");
      return withOwner(c, params, async (owner) =>
        stateResponse(c, await service.get(owner, params.operationId, c.req.raw.signal)),
      );
    },
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: `${transferPath}/content`,
      tags: ["Assets"],
      request: {
        params: transferParams,
        query: z.strictObject({ offset: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }),
        body: { content: binary },
      },
      responses: { 200: { description: "Append bytes at the recoverable offset.", content: json }, ...errors },
    }),
    async (c) => {
      const params = c.req.valid("param");
      return withOwner(c, params, async (owner) =>
        stateResponse(
          c,
          await service.append(
            owner,
            params.operationId,
            c.req.valid("query").offset,
            c.req.raw.body ?? new Blob([]).stream(),
            c.req.raw.signal,
          ),
        ),
      );
    },
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: `${transferPath}/complete`,
      tags: ["Assets"],
      request: { params: transferParams },
      responses: {
        200: { description: "Publish only after size and checksum verification.", content: json },
        ...errors,
      },
    }),
    async (c) => {
      const params = c.req.valid("param");
      return withOwner(c, params, async (owner) =>
        stateResponse(c, await service.complete(owner, params.operationId, c.req.raw.signal)),
      );
    },
  );
  routes.openapi(
    createRoute({
      method: "delete",
      path: transferPath,
      tags: ["Assets"],
      request: { params: transferParams },
      responses: {
        200: { description: "Cancel temporary bytes; complete versions remain retained.", content: json },
        ...errors,
      },
    }),
    async (c) => {
      const params = c.req.valid("param");
      return withOwner(c, params, async (owner) => stateResponse(c, await service.cancel(owner, params.operationId)));
    },
  );
  routes.openapi(
    createRoute({
      method: "get",
      path: `${base}/assets/{sha256}/content`,
      tags: ["Assets"],
      request: {
        params: ownerParams.extend({ sha256: assetReferenceSchema.shape.sha256 }),
        query: z.strictObject({
          byteLength: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
          mediaType: z.string().min(1),
        }),
      },
      responses: {
        200: { description: "Stream a complete immutable version with integrity verification.", content: binary },
        ...errors,
      },
    }),
    async (c) => {
      const params = c.req.valid("param");
      const asset = { sha256: params.sha256, ...c.req.valid("query") };
      return withOwner(
        c,
        params,
        async (owner) =>
          new Response(await service.read(owner, asset), {
            headers: {
              "content-type": asset.mediaType,
              "content-length": String(asset.byteLength),
              etag: `"${asset.sha256}"`,
              "cache-control": "private, no-cache",
            },
          }),
      );
    },
  );
  return routes;
};
