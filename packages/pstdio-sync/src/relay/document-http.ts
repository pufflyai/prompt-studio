import {
  blobStatusSchema,
  readResultSchema,
  type SyncRoute,
  stateResultSchema,
  syncBlobReferencesFeature,
  syncCapabilitiesSchema,
  syncErrorSchema,
  syncPath,
  syncProtocolHeader,
  syncProtocolVersion,
  updateResultSchema,
} from "pstdio-sync-contracts";
import type { SyncSpace } from "../encryption";
import { DocumentBlobMissing, type DocumentRelay, DocumentUpdateTooLarge } from "./document-sync-types";
import { readExactResponse } from "./exact-response";
import { serviceAddress, serviceUrl } from "./http";

export const createDocumentRelay = (input: {
  origin: string;
  space: Pick<SyncSpace, "projectId" | "spaceOwner">;
  documentId: string;
  token: () => Promise<string>;
  signal: AbortSignal;
}) => {
  const address = serviceAddress(input.origin);
  const space = { projectId: input.space.projectId, spaceOwner: input.space.spaceOwner };
  const request = async (route: SyncRoute, init: RequestInit = {}) => {
    input.signal.throwIfAborted();
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${await input.token()}`);
    headers.set(syncProtocolHeader, String(syncProtocolVersion));
    return fetch(serviceUrl(address, syncPath(route)), { ...init, headers, signal: input.signal });
  };
  const checked = async (response: Response) => {
    if (response.ok) return response;
    await response.body?.cancel();
    throw new Error(`Document relay request failed (${response.status})`);
  };
  const post = (route: SyncRoute, body: unknown) =>
    request(route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const document = (operation: "read" | "updates" | "state") =>
    ({ kind: "document", ...space, documentId: input.documentId, operation }) as const;
  const blob = (blobId: string, operation: "begin" | "begin-manifest" | "finish" | "read") =>
    ({ kind: "blob", ...space, blobId, operation }) as const;
  const putBlob = async (
    blobId: string,
    bytes: Uint8Array,
    operation: "begin" | "begin-manifest",
    children?: string[],
  ) => {
    const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    const status = blobStatusSchema.parse(
      await (
        await checked(
          await post(blob(blobId, operation), {
            sha256: sha256(bytes),
            byteLength: bytes.length,
            ...(operation === "begin-manifest" ? { children } : {}),
          }),
        )
      ).json(),
    );
    if (status.completed) return;
    for (let offset = 0, number = 1; offset < bytes.length; offset += status.partSize, number++) {
      const part = bytes.subarray(offset, offset + status.partSize);
      const hash = sha256(part);
      if (
        status.parts.some(
          (existing) => existing.number === number && existing.sha256 === hash && existing.byteLength === part.length,
        )
      )
        continue;
      const response = await checked(
        await request(
          { kind: "part", ...space, blobId, number },
          {
            method: "PUT",
            body: part as Uint8Array<ArrayBuffer>,
            headers: { "pstdio-sha256": hash, "content-length": String(part.length) },
          },
        ),
      );
      await response.body?.cancel();
    }
    await (await checked(await post(blob(blobId, "finish"), {}))).body?.cancel();
  };

  const readBlob = async (blobId: string, offset: number) => {
    const response = await post(blob(blobId, "read"), { offset });
    if (response.status === 404) {
      await response.body?.cancel();
      throw new DocumentBlobMissing();
    }
    return (await checked(response)).body!;
  };

  const relay = {
    read: async (after) =>
      readResultSchema.parse(await (await checked(await post(document("read"), { after }))).json()),
    state: async (state) =>
      new Uint8Array(
        await (
          await checked(
            await request({
              kind: "state",
              ...space,
              documentId: input.documentId,
              stateId: state.stateId,
            }),
          )
        ).arrayBuffer(),
      ),
    update: async (update) => {
      const response = await post(document("updates"), update);
      if (response.status === 413) {
        const error = syncErrorSchema.parse(await response.json());
        if (error.error === "too-large") throw new DocumentUpdateTooLarge();
        throw new Error("Document relay rejected update");
      }
      return updateResultSchema.parse(await (await checked(response)).json());
    },
    replace: async (state) => {
      const response = await post(document("state"), state);
      if (response.status === 409) {
        const error = syncErrorSchema.parse(await response.json());
        if (error.error === "stale-state") return false;
        throw new Error("Document relay rejected latest state");
      }
      stateResultSchema.parse(await (await checked(response)).json());
      return true;
    },
    blobs: {
      put: (blobId, bytes) => putBlob(blobId, bytes, "begin"),
      read: readBlob,
      get: async (blobId) => new Uint8Array(await new Response(await readBlob(blobId, 0)).arrayBuffer()),
    },
  } satisfies DocumentRelay;
  return {
    ...relay,
    async manifestBlobs() {
      const response = await request({ kind: "capabilities", projectId: space.projectId });
      if (response.status === 404) {
        await response.body?.cancel();
        throw new Error("Relay does not support blob references");
      }
      const capabilities = syncCapabilitiesSchema.parse(await (await checked(response)).json());
      if (!capabilities.features.includes(syncBlobReferencesFeature))
        throw new Error("Relay does not support blob references");
      return {
        put: (blobId: string, bytes: Uint8Array, children: string[]) =>
          putBlob(blobId, bytes, "begin-manifest", children),
        // The manifest reader supplies its validated, authenticated ciphertext extent.
        async get(blobId: string, byteLength: number) {
          const response = await post(blob(blobId, "read"), { offset: 0 });
          if (response.status === 404) {
            await response.body?.cancel();
            throw new DocumentBlobMissing();
          }
          return readExactResponse(await checked(response), byteLength);
        },
      };
    },
  };
};
