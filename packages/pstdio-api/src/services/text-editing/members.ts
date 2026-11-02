import type { TextEditingRequest, TextWireSnapshot } from "pstdio-api-contracts/extension-kernel";
import { validateTextEditorFrame } from "pstdio-sync/text";
import { validateTextGrant } from "./admission";
import { textFailure } from "./errors";
import { textHandleMember } from "./handles";
import type { TextConnection, TextEditingDeps, TextMember } from "./types";
export const roomAddress = (connection: TextConnection, member: TextMember) => {
  if (!member.room) throw textFailure("session_closed", "The text session is not open");
  return { projectId: connection.projectId, roomId: member.room.roomId, documentKey: member.room.documentKey };
};
export const textMember = (connection: TextConnection, handle: string) => {
  const id = textHandleMember(connection, handle);
  const member = connection.members.get(id);
  if (!member || member.handle !== handle || !member.grant)
    throw textFailure("session_closed", "The text session is closed");
  return member;
};
export const runTextMember = <T>(member: TextMember, run: () => Promise<T>) => {
  const work = member.queue.then(run);
  member.queue = work.catch(() => {});
  return work;
};
export const wireTextSnapshot = (
  member: TextMember,
  snapshot: Awaited<ReturnType<TextEditingDeps["documents"]["snapshot"]>>,
  editable = true,
): TextWireSnapshot => ({
  state: Buffer.from(snapshot.state).toString("base64"),
  seedId: snapshot.seedId,
  sourceSeedId: snapshot.sourceSeedId,
  sourceState: snapshot.sourceState ? Buffer.from(snapshot.sourceState).toString("base64") : undefined,
  revision: snapshot.revision,
  editable: editable && member.grant!.editable && member.room?.content.editable !== false,
});
export const submitTextMember = (
  deps: TextEditingDeps,
  connection: TextConnection,
  member: TextMember,
  request: Extract<TextEditingRequest, { operation: "submit" }>,
) =>
  runTextMember(member, async () => {
    const loaded = await validateTextGrant(deps, connection, member.grant!);
    if (member.ready) throw textFailure("session_closed", "This member has completed close preparation");
    if (request.sequence === member.sequence && request.update === member.lastFrame && member.lastAck)
      return { ...member.lastAck, editable: member.grant!.editable && loaded.content.editable !== false };
    if (!member.grant!.editable || loaded.content.editable === false)
      throw textFailure("source_read_only", "The text source is read only");
    if (request.sequence !== member.sequence + 1)
      throw textFailure("invalid_frame", "Text submissions must keep their member sequence");
    const history = await deps.documents.snapshot(roomAddress(connection, member));
    await validateTextEditorFrame(history.sourceState ?? history.state, Buffer.from(request.update, "base64"));
    const snapshot = await deps.documents.submit({
      ...roomAddress(connection, member),
      update: Buffer.from(request.update, "base64"),
    });
    member.sequence = request.sequence;
    member.lastFrame = request.update;
    member.lastAck = wireTextSnapshot(member, snapshot);
    return member.lastAck;
  });
