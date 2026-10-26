import { expect, test } from "bun:test";
import { type SyncRoute, syncPath, syncRoute } from "./routes";

const documentId = "doc_0123456789abcdef";
const blobId = "blob_0123456789abcdef";
const stateId = "state_0123456789abcdef";

test("every route survives a path round trip", () => {
  const routes: SyncRoute[] = [
    { kind: "capabilities", projectId: "project/1" },
    { kind: "blob", projectId: "p", spaceOwner: null, blobId, operation: "begin-manifest" },
    { kind: "document", projectId: "project/1", spaceOwner: null, documentId, operation: "updates" },
    { kind: "document", projectId: "p", spaceOwner: "user..1", documentId, operation: "read" },
    { kind: "document", projectId: "p", spaceOwner: null, documentId, operation: "state" },
    { kind: "state", projectId: "p", spaceOwner: "u", documentId, stateId },
    { kind: "blob", projectId: "p", spaceOwner: null, blobId, operation: "begin" },
    { kind: "blob", projectId: "p", spaceOwner: "u", blobId, operation: "finish" },
    { kind: "blob", projectId: "p", spaceOwner: null, blobId, operation: "read" },
    { kind: "part", projectId: "p", spaceOwner: null, blobId, number: 3 },
    { kind: "live", projectId: ".." },
  ];
  for (const route of routes) expect(syncRoute(syncPath(route))).toEqual(route);
});

test("opaque identities never become path segments", () => {
  const path = syncPath({ kind: "live", projectId: "../.." });
  expect(path).toBe("/sync/projects/~..%2F../live");
});

test("capability discovery and explicit manifest uploads have distinct protocol routes", () => {
  expect(syncRoute("/sync/projects/~project%2F1/capabilities")).toEqual({
    kind: "capabilities",
    projectId: "project/1",
  });
  expect(syncRoute(`/sync/projects/~p/spaces/~u/blobs/~${blobId}/begin-manifest`)).toEqual({
    kind: "blob",
    projectId: "p",
    spaceOwner: "u",
    blobId,
    operation: "begin-manifest",
  });
  expect(syncRoute("/sync/projects/~p/spaces/~u/capabilities")).toBeNull();
});

test("unknown operations and named document identities are rejected", () => {
  expect(syncRoute(`/sync/projects/~p/documents/~${documentId}/snapshot`)).toBeNull();
  expect(syncRoute("/sync/projects/~p/documents/~notes/read")).toBeNull();
  expect(syncRoute(`/sync/projects/~p/blobs/~${blobId}/parts/0`)).toBeNull();
  expect(syncRoute("/v1/workbenches/~w/extensions/~x/snapshot")).toBeNull();
});
