import type { TextEditingEvent, TextWireParticipant, TextWireSnapshot } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import { decodeTextBytes, textEditingError } from "./text-editing-codec";
import type { TextEditingSnapshot } from "./text-editing-types";

const participants = (people: TextWireParticipant[]) =>
  people.map((person) => ({
    ...person,
    selection: person.selection
      ? { anchor: decodeTextBytes(person.selection.anchor), head: decodeTextBytes(person.selection.head) }
      : null,
  }));

export const createTextEditingReceiver = (input: {
  host: GuestHost;
  memberId: string;
  handle: () => string;
  closed: () => boolean;
  prepareClose: () => Promise<void>;
  cancelClose: (error: unknown) => void;
  receive: (snapshot: TextWireSnapshot) => void;
  failed: (error: unknown) => void;
  publish: (patch: Partial<TextEditingSnapshot>) => void;
}) => {
  let handle = input.handle();
  let snapshotVersion = -1;
  let presenceVersion = -1;
  let barrierId: string | undefined;
  const prepare = (active: string) => {
    if (barrierId === active) return;
    barrierId = active;
    void input
      .prepareClose()
      .then(() => {
        if (barrierId === active)
          return input.host.call("editing.text", {
            operation: "closeReady",
            memberId: input.memberId,
            barrierId: active,
          });
      })
      .catch((error) => {
        const { code, message, retryable } = textEditingError(error);
        if (barrierId === active)
          return input.host.call("editing.text", {
            operation: "closeFailed",
            memberId: input.memberId,
            barrierId: active,
            error: { code, message, retryable },
          });
      })
      .catch(() => {});
  };
  const failure = (event: Extract<TextEditingEvent, { type: "error" | "retired" }>) => {
    if (event.barrierId) {
      if (barrierId === event.barrierId) {
        barrierId = undefined;
        input.cancelClose(event.error);
      }
    } else if (event.handle === input.handle()) input.failed(event.error);
  };
  const data = (event: Extract<TextEditingEvent, { type: "snapshot" | "presence" }>) => {
    if (event.handle !== input.handle()) return;
    if (event.handle !== handle) {
      handle = event.handle;
      snapshotVersion = -1;
      presenceVersion = -1;
    }
    if (event.type === "snapshot" && event.version > snapshotVersion) {
      snapshotVersion = event.version;
      input.receive(event.snapshot);
    }
    if (event.type === "presence" && event.version > presenceVersion) {
      presenceVersion = event.version;
      input.publish({ participants: participants(event.participants) });
    }
  };
  return (event: TextEditingEvent) => {
    if (input.closed()) return;
    switch (event.type) {
      case "prepareClose":
        prepare(event.barrierId);
        return;
      case "error":
      case "retired":
        failure(event);
        return;
      default:
        data(event);
    }
  };
};
