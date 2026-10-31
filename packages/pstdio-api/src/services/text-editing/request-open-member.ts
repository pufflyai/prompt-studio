import type { TextEditingRequest } from "pstdio-api-contracts/extension-kernel";
import { validateTextGrant } from "./admission";
import { textFailure } from "./errors";
import { failTextClose, readyTextClose } from "./events";
import { roomAddress, submitTextMember, textMember, wireTextSnapshot } from "./members";
import type { TextConnection, TextEditingDeps, TextMember } from "./types";
export const requestOpenMember = async (
  deps: TextEditingDeps,
  connection: TextConnection,
  input: TextEditingRequest,
) => {
  let member: TextMember | undefined;
  if ("memberId" in input) member = connection.members.get(input.memberId);
  else if ("handle" in input) member = textMember(connection, input.handle);
  if (!member) throw textFailure("session_closed", "This text membership has been released");
  switch (input.operation) {
    case "closeReady":
      return readyTextClose(connection, member, input.barrierId);
    case "closeFailed":
      if (connection.barrier?.id !== input.barrierId)
        throw textFailure("grant_invalid", "This close barrier is no longer active");
      failTextClose(connection, input.error);
      return;
    case "submit":
      return submitTextMember(deps, connection, member, input);
    case "snapshot": {
      const loaded = await validateTextGrant(deps, connection, member.grant!);
      return wireTextSnapshot(
        member,
        await deps.documents.snapshot(roomAddress(connection, member)),
        loaded.content.editable !== false,
      );
    }
    case "project":
      await validateTextGrant(deps, connection, member.grant!, true);
      return deps.documents.project({ ...roomAddress(connection, member), revision: input.revision });
    case "presence":
      await validateTextGrant(deps, connection, member.grant!);
      if (!connection.active || member.ready)
        throw textFailure("session_closed", "This placement is not participating");
      member.selection = input.selection;
      await member.updatePresence?.();
      return;
  }
};
