import { nativePresenceLimits } from "pstdio-api-contracts";
import { validateTextGrant } from "./admission";
import { textError } from "./errors";
import { emitTextEvent } from "./events";
import { roomAddress, wireTextSnapshot } from "./members";
import type { TextConnection, TextEditingDeps, TextMember } from "./types";

export const observeTextMember = (deps: TextEditingDeps, connection: TextConnection, member: TextMember) => {
  if (member.stop || !member.room || !connection.active || !connection.listeners.size) return;
  const room = member.room;
  const address = roomAddress(connection, member);
  let stopped = false;
  let dirty = true;
  let reading = false;
  let stopWatch: (() => void) | undefined;
  let stopPresence: (() => void) | undefined;
  let presence: Awaited<ReturnType<typeof deps.documents.presence.join>> | undefined;
  let seedId = room.seedId;
  const current = () =>
    !stopped &&
    !connection.disposed &&
    connection.active &&
    connection.members.get(member.id) === member &&
    member.room === room;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(heartbeat);
    stopWatch?.();
    stopPresence?.();
    presence?.close();
    member.updatePresence = undefined;
    member.refresh = undefined;
    member.stop = undefined;
  };
  const failed = (error: unknown) => {
    if (!current()) return;
    const failure = textError(error);
    stop();
    emitTextEvent(connection, {
      type: failure.code === "source_retired" ? "retired" : "error",
      memberId: member.id,
      handle: member.handle,
      error: failure,
    });
  };
  const emitPresence = () => {
    if (!current() || !presence) return;
    emitTextEvent(connection, {
      type: "presence",
      memberId: member.id,
      handle: member.handle,
      version: ++member.version,
      participants: presence.snapshot().map((person) => ({
        id: person.participantId,
        label: person.label,
        deviceName: person.deviceName,
        selection: person.selection,
      })),
    });
  };
  const updatePresence = async () => {
    await validateTextGrant(deps, connection, member.grant!);
    if (!current() || !presence) return;
    await deps.documents.presence.update({
      ...address,
      participantId: presence.participantId,
      seedId,
      selection: member.selection,
    });
  };
  const heartbeat = setInterval(() => {
    void updatePresence().catch(failed);
  }, nativePresenceLimits.heartbeatMs);
  heartbeat.unref?.();
  const drain = async () => {
    if (reading) return;
    reading = true;
    try {
      while (dirty && current()) {
        dirty = false;
        const loaded = await validateTextGrant(deps, connection, member.grant!);
        const snapshot = await deps.documents.snapshot(address);
        if (!current()) return;
        if (seedId !== snapshot.seedId) {
          seedId = snapshot.seedId;
          member.selection = null;
        }
        emitTextEvent(connection, {
          type: "snapshot",
          memberId: member.id,
          handle: member.handle,
          version: ++member.version,
          snapshot: wireTextSnapshot(member, snapshot, loaded.content.editable !== false),
        });
      }
    } finally {
      reading = false;
    }
  };
  const refresh = () => {
    dirty = true;
    void drain().catch(failed);
  };
  member.stop = stop;
  member.refresh = refresh;
  member.updatePresence = updatePresence;
  void (async () => {
    stopWatch = await deps.documents.watch(address, refresh, stop);
    if (!current()) {
      stopWatch();
      return;
    }
    await drain();
    if (!current()) return;
    presence = await deps.documents.presence.join({ ...address, seedId });
    if (!current()) {
      presence.close();
      return;
    }
    stopPresence = presence.watch(emitPresence);
    await updatePresence();
    emitPresence();
  })().catch(failed);
};
