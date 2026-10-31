import { createHash } from "node:crypto";
import type { TextEditingRequest } from "pstdio-api-contracts/extension-kernel";
import { validateTextEditorFrame, validateTextEditorState } from "pstdio-sync/text";
import {
  grantTextSource,
  textSourceIdentity,
  validateTextGrant,
  validateTextPresentation,
  validateTextSelection,
} from "./admission";
import { textFailure } from "./errors";
import { textHandle } from "./handles";
import { roomAddress, runTextMember, wireTextSnapshot } from "./members";
import type { TextConnection, TextEditingDeps, TextGrant, TextMember } from "./types";

type OpenRequest = Extract<TextEditingRequest, { operation: "open" }>;
const sourceGrant = async (
  deps: TextEditingDeps,
  connection: TextConnection,
  request: Extract<TextEditingRequest, { operation: "open" }>,
) => {
  if ("grant" in request.input) {
    const grant = connection.grants.get(request.input.grant.token);
    if (!grant) throw textFailure("grant_invalid", "This source grant belongs to another placement");
    return grant;
  }
  if (!connection.extensionId) throw textFailure("grant_invalid", "This caller needs a selected source grant");
  return grantTextSource(deps, connection, { extensionId: connection.extensionId, textDocument: request.input });
};
const requireRecoveryAccess = (
  request: Extract<TextEditingRequest, { operation: "open" }>,
  grant: TextGrant,
  editable: boolean,
) => {
  if ((request.sourceState || request.pendingUpdate) && (!grant.editable || !editable))
    throw textFailure("source_read_only", "The text source is read only");
};
const requireCurrentMember = (connection: TextConnection, member: TextMember) => {
  if (connection.disposed || member.ready || connection.members.get(member.id) !== member)
    throw textFailure("session_closed", "This text membership has been released");
};
const memberGrant = async (
  deps: TextEditingDeps,
  connection: TextConnection,
  member: TextMember,
  request: OpenRequest,
) => {
  let grant = await sourceGrant(deps, connection, request);
  if (member.grant) {
    if (grant !== member.grant && grant.token !== connection.selected) connection.grants.delete(grant.token);
    if (member.grant.documentKey !== grant.documentKey || member.grant.ownerId !== grant.ownerId)
      throw textFailure("source_changed", "An open member cannot select another source lifetime");
    grant = member.grant;
  }
  member.grant = grant;
  return grant;
};
const validateRecovery = async (request: OpenRequest) => {
  if (request.pendingUpdate && !request.sourceState)
    throw textFailure("missing_history", "A pending draft needs its original history");
  if (!request.sourceState) return;
  const state = Buffer.from(request.sourceState, "base64");
  await validateTextEditorState(state);
  if (request.pendingUpdate) await validateTextEditorFrame(state, Buffer.from(request.pendingUpdate, "base64"));
};
const currentRoom = async (
  deps: TextEditingDeps,
  connection: TextConnection,
  member: TextMember,
  request: OpenRequest,
) => {
  if (!member.room || request.sourceState || request.pendingUpdate) return;
  const snapshot = await deps.documents.snapshot(roomAddress(connection, member));
  requireCurrentMember(connection, member);
  if (snapshot.seedId === snapshot.sourceSeedId)
    return {
      sourceIdentity: textSourceIdentity(connection, member.grant!),
      handle: member.handle,
      grant: { token: member.grant!.token },
      snapshot: wireTextSnapshot(member, snapshot),
    };
};
const reopen = async (
  deps: TextEditingDeps,
  connection: TextConnection,
  member: TextMember,
  grant: TextGrant,
  request: OpenRequest,
) => {
  requireCurrentMember(connection, member);
  const previous = member.room;
  const joined = await deps.documents.open({
    ...grant.target,
    projectId: connection.projectId,
    access: grant.editable ? "write" : "read",
    validateLoaded: (loaded) => validateTextSelection(connection, grant.target, loaded),
    expectedSource: {
      owner: { workbenchId: connection.projectId, extensionId: grant.ownerId },
      documentKey: grant.documentKey,
    },
    sourceState: request.sourceState ? Buffer.from(request.sourceState, "base64") : undefined,
    pendingUpdate: request.pendingUpdate ? Buffer.from(request.pendingUpdate, "base64") : undefined,
  });
  member.stop?.();
  member.stop = undefined;
  member.room = joined;
  member.handle ||= textHandle(connection, member, grant.token);
  if (previous)
    await deps.documents.release({
      projectId: connection.projectId,
      roomId: previous.roomId,
      documentKey: previous.documentKey,
    });
  requireCurrentMember(connection, member);
  return {
    sourceIdentity: textSourceIdentity(connection, grant),
    handle: member.handle,
    grant: { token: grant.token },
    snapshot: wireTextSnapshot(member, joined),
  };
};
export const openTextMember = (
  deps: TextEditingDeps,
  connection: TextConnection,
  member: TextMember,
  request: OpenRequest,
) =>
  runTextMember(member, async () => {
    requireCurrentMember(connection, member);
    await validateTextPresentation(deps, connection);
    requireCurrentMember(connection, member);
    const grant = await memberGrant(deps, connection, member, request);
    if (request.sourceIdentity && request.sourceIdentity !== textSourceIdentity(connection, grant))
      throw textFailure("source_retired", "This source lifetime has changed since the session opened");
    const loaded = await validateTextGrant(deps, connection, grant);
    requireCurrentMember(connection, member);
    await validateRecovery(request);
    requireCurrentMember(connection, member);
    const identity = createHash("sha256")
      .update(JSON.stringify([grant.token, request.sourceState, request.pendingUpdate]))
      .digest("hex");
    if (request.pendingUpdate && member.replay?.identity === identity)
      return {
        ...member.replay.result,
        snapshot: { ...member.replay.result.snapshot, editable: grant.editable && loaded.content.editable !== false },
      };
    requireRecoveryAccess(request, grant, loaded.content.editable !== false);
    const current = await currentRoom(deps, connection, member, request);
    if (current) return current;
    const result = await reopen(deps, connection, member, grant, request);
    if (request.pendingUpdate) member.replay = { identity, result };
    return result;
  });
