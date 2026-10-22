import { z } from "zod";
import { identitySchema } from "../wire";
import { syncIdSchema } from "./envelopes";

/** Version of the sync protocol. Every request and live connection sends it in this header. */
export const syncProtocolVersion = 1;
export const syncProtocolHeader = "pstdio-sync-protocol";

const space = { projectId: identitySchema, spaceOwner: identitySchema.nullable() };
const routeSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("document"),
    ...space,
    documentId: syncIdSchema,
    operation: z.enum(["updates", "read", "state"]),
  }),
  z.strictObject({ kind: z.literal("state"), ...space, documentId: syncIdSchema, stateId: syncIdSchema }),
  z.strictObject({
    kind: z.literal("blob"),
    ...space,
    blobId: syncIdSchema,
    operation: z.enum(["begin", "finish", "read"]),
  }),
  z.strictObject({
    kind: z.literal("part"),
    ...space,
    blobId: syncIdSchema,
    number: z.number().int().min(1).max(10_000),
  }),
  z.strictObject({ kind: z.literal("live"), projectId: identitySchema }),
]);
export type SyncRoute = z.infer<typeof routeSchema>;

// A prefix keeps even opaque '.' and '..' identities from becoming URL traversal segments.
const segment = (value: string) => `~${encodeURIComponent(value)}`;

export const syncPath = (input: SyncRoute) => {
  const route = routeSchema.parse(input);
  const project = `/sync/projects/${segment(route.projectId)}`;
  if (route.kind === "live") return `${project}/live`;
  const base = route.spaceOwner === null ? project : `${project}/spaces/${segment(route.spaceOwner)}`;
  if (route.kind === "document") return `${base}/documents/${segment(route.documentId)}/${route.operation}`;
  if (route.kind === "state") return `${base}/documents/${segment(route.documentId)}/states/${segment(route.stateId)}`;
  if (route.kind === "blob") return `${base}/blobs/${segment(route.blobId)}/${route.operation}`;
  return `${base}/blobs/${segment(route.blobId)}/parts/${route.number}`;
};

const pattern =
  /^\/sync\/projects\/~([^/]+)(?:\/spaces\/~([^/]+))?(?:\/(documents|blobs)\/~([^/]+)\/(updates|read|state|begin|finish|states\/~[^/]+|parts\/\d+)|\/(live))$/;

const parse = (match: RegExpExecArray) => {
  const [, project, owner, collection, id, operation, live] = match;
  const projectId = decodeURIComponent(project!);
  if (live) return owner ? null : { kind: "live", projectId };
  const base = { projectId, spaceOwner: owner === undefined ? null : decodeURIComponent(owner) };
  const target = decodeURIComponent(id!);
  if (collection === "documents") {
    if (operation!.startsWith("states/~"))
      return { kind: "state", ...base, documentId: target, stateId: decodeURIComponent(operation!.slice(8)) };
    return { kind: "document", ...base, documentId: target, operation };
  }
  if (operation!.startsWith("parts/"))
    return { kind: "part", ...base, blobId: target, number: Number(operation!.slice(6)) };
  return { kind: "blob", ...base, blobId: target, operation };
};

export const syncRoute = (pathname: string) => {
  const match = pattern.exec(pathname);
  if (!match) return null;
  try {
    const route = routeSchema.safeParse(parse(match));
    return route.success ? route.data : null;
  } catch {
    return null;
  }
};
