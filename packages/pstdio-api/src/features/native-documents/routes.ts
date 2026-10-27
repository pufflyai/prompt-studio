import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  nativeDocumentFrameSchema,
  nativeDocumentJoinedSchema,
  nativeDocumentOpenSchema,
  nativeDocumentSnapshotSchema,
  nativePresenceUpdateSchema,
} from "pstdio-api-contracts";
import { NativeDocumentRoomError } from "pstdio-db";
import { NativeSourcePendingError, NativeSourceRecoveryError, StorageRevisionChangedError } from "pstdio-sync";
import type { createNativeDocumentService } from "../../services/native-documents/documents";
import { NativeDocumentSourceError } from "../../services/native-documents/file-source";
import { NativePresenceError } from "../../services/native-documents/presence";
import type { AppBindings } from "../../types";
import { streamNativeDocument } from "./stream";

const projectParams = z.object({ projectId: z.string() });
const documentParams = projectParams.extend({ documentKey: z.string().regex(/^[a-f0-9]{64}$/) });
const roomQuery = z.object({ roomId: z.uuid() });
const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });
const base = "/projects/{projectId}/native-documents";
const sourceFailure = (error: Error) => {
  if (error instanceof NativeSourcePendingError) return { status: 503 as const, code: error.code };
  if (error instanceof NativeSourceRecoveryError) return { status: 409 as const, code: error.code };
  if (error instanceof StorageRevisionChangedError) return { status: 409 as const, code: "storage_revision_changed" };
};
const wireSnapshot = <T extends { state: Uint8Array; seedId: string; sourceSeedId: string; sourceState?: Uint8Array }>(
  value: T,
) => ({
  ...value,
  state: Buffer.from(value.state).toString("base64"),
  sourceState: value.sourceState ? Buffer.from(value.sourceState).toString("base64") : undefined,
});

export const createNativeDocumentRoutes = (service: ReturnType<typeof createNativeDocumentService>) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.onError((error, c) => {
    const source = sourceFailure(error);
    if (source) return c.json({ error: error.message, code: source.code }, source.status);
    if (error instanceof NativePresenceError)
      return c.json(
        { error: error.message, code: `native_presence_${error.code}` },
        error.code === "room_limit" ? 429 : 404,
      );
    if (error instanceof z.ZodError)
      return c.json({ error: "Invalid native presence", code: "native_presence_invalid" }, 400);
    if (error instanceof NativeDocumentSourceError)
      return c.json({ error: error.message, code: error.code }, error.status);
    if (error instanceof NativeDocumentRoomError) {
      let status: 400 | 404 | 409 = 400;
      if (error.code === "not_found") status = 404;
      if (error.code === "missing_history") status = 409;
      return c.json({ error: error.message, code: `native_document_${error.code}` }, status);
    }
    throw error;
  });
  routes.openapi(
    createRoute({
      method: "post",
      path: `${base}/{documentKey}/presence`,
      tags: ["Native documents"],
      request: { params: documentParams, body: { content: json(nativePresenceUpdateSchema) } },
      responses: {
        200: { description: "Transient presence updated.", content: json(z.object({ updated: z.literal(true) })) },
      },
    }),
    async (c) => {
      await service.presence.update({ ...c.req.valid("param"), ...c.req.valid("json") });
      return c.json({ updated: true as const }, 200);
    },
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: base,
      tags: ["Native documents"],
      request: { params: projectParams, body: { content: json(nativeDocumentOpenSchema) } },
      responses: {
        200: { description: "A locally durable shared Markdown room.", content: json(nativeDocumentJoinedSchema) },
      },
    }),
    async (c) => {
      const { sourceState, pendingUpdate, ...target } = c.req.valid("json");
      const joined = await service.open({
        ...target,
        resource: target.resource,
        projectId: c.req.valid("param").projectId,
        signal: c.req.raw.signal,
        sourceState: sourceState === undefined ? undefined : Buffer.from(sourceState, "base64"),
        pendingUpdate: pendingUpdate === undefined ? undefined : Buffer.from(pendingUpdate, "base64"),
      });
      const { owner: _owner, ...result } = joined;
      return c.json(wireSnapshot(result), 200);
    },
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: `${base}/{documentKey}/updates`,
      tags: ["Native documents"],
      request: { params: documentParams, body: { content: json(nativeDocumentFrameSchema) } },
      responses: {
        200: {
          description: "The edit is saved locally and integrated.",
          content: json(nativeDocumentSnapshotSchema.extend({ revision: z.number() })),
        },
      },
    }),
    async (c) => {
      const frame = c.req.valid("json");
      return c.json(
        wireSnapshot(
          await service.submit({
            ...c.req.valid("param"),
            roomId: frame.roomId,
            update: Buffer.from(frame.update, "base64"),
          }),
        ),
        200,
      );
    },
  );
  routes.openapi(
    createRoute({
      method: "get",
      path: `${base}/{documentKey}`,
      tags: ["Native documents"],
      request: { params: documentParams, query: roomQuery },
      responses: { 200: { description: "The current shared source.", content: json(nativeDocumentSnapshotSchema) } },
    }),
    async (c) =>
      c.json(wireSnapshot(await service.snapshot({ ...c.req.valid("param"), ...c.req.valid("query") })), 200),
  );
  routes.openapi(
    createRoute({
      method: "get",
      path: `${base}/{documentKey}/stream`,
      tags: ["Native documents"],
      request: { params: documentParams, query: roomQuery },
      responses: {
        200: {
          description: "Current source and live document changes.",
          content: { "text/event-stream": { schema: z.string() } },
        },
      },
    }),
    async (c) => {
      const room = { ...c.req.valid("param"), ...c.req.valid("query") };
      await service.snapshot(room);
      return streamNativeDocument(c, service, room);
    },
  );
  routes.openapi(
    createRoute({
      method: "delete",
      path: `${base}/{documentKey}`,
      tags: ["Native documents"],
      request: { params: documentParams, query: roomQuery },
      responses: {
        200: { description: "The local room is closed.", content: json(z.object({ closed: z.boolean() })) },
      },
    }),
    async (c) => {
      await service.close({ ...c.req.valid("param"), ...c.req.valid("query") });
      return c.json({ closed: true }, 200);
    },
  );
  return routes;
};
