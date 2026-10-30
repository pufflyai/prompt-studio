import {
  type NativeDocumentSelection,
  type NativePresenceLive,
  nativePresenceLimits,
  nativePresenceLiveSchema,
} from "pstdio-api-contracts";
import type { StorageOwner } from "pstdio-sync";
import { createPresenceHub, type PresenceAddress, type PresenceChange, PresenceError } from "pstdio-sync/presence";

export { PresenceError as NativePresenceError } from "pstdio-sync/presence";

interface Address {
  owner: StorageOwner;
  documentKey: string;
}
interface Connection extends Address {
  roomId: string;
  seedId: string;
  label: string;
  deviceName: string;
}
type Value = Pick<Extract<NativePresenceLive, { action: "upsert" }>, "seedId" | "label" | "deviceName" | "selection">;
const addressOf = (address: Address) => ({ owner: address.owner, resourceId: address.documentKey });
const presenceValue = ({
  seedId,
  label,
  deviceName,
  selection,
}: Extract<NativePresenceLive, { action: "upsert" }>) => ({
  seedId,
  label,
  deviceName,
  selection,
});
const upsertFrame = (address: PresenceAddress, participantId: string, value: Value) => {
  const frame = nativePresenceLiveSchema.parse({
    kind: "native-document-presence",
    version: 1,
    action: "upsert",
    extensionId: address.owner.extensionId,
    documentKey: address.resourceId,
    participantId,
    ...value,
  });
  if (frame.action !== "upsert") throw new Error("Invalid native presence update");
  return frame;
};
const frameOf = (address: PresenceAddress, change: PresenceChange<Value>) =>
  change.action === "upsert"
    ? upsertFrame(address, change.participantId, change.value)
    : ({
        kind: "native-document-presence",
        version: 1,
        action: "leave",
        extensionId: address.owner.extensionId,
        documentKey: address.resourceId,
        participantId: change.participantId,
      } satisfies NativePresenceLive);

/** Native text wire validation and room authorization wrap the format-independent live registry. */
export const createNativePresence = (input: {
  deviceId: string;
  now?: () => number;
  send(owner: StorageOwner, frame: NativePresenceLive): void | Promise<void>;
}) => {
  const hub = createPresenceHub<Value>({
    deviceId: input.deviceId,
    now: input.now,
    leaseMs: nativePresenceLimits.leaseMs,
    maxRooms: nativePresenceLimits.rooms,
    send: (address, change) => input.send(address.owner, frameOf(address, change)),
  });
  return {
    open(connection: Connection) {
      const address = addressOf(connection);
      const opened = hub.open(address, (id) =>
        presenceValue(
          upsertFrame(address, id, {
            seedId: connection.seedId,
            label: connection.label,
            deviceName: connection.deviceName,
            selection: null,
          }),
        ),
      );
      return {
        participantId: opened.participantId,
        update(update: { roomId: string; seedId: string; selection: NativeDocumentSelection }) {
          if (update.roomId !== connection.roomId)
            throw new PresenceError("not_found", "Native presence connection not found");
          opened.update(
            presenceValue(
              upsertFrame(address, opened.participantId, {
                seedId: update.seedId,
                label: connection.label,
                deviceName: connection.deviceName,
                selection: update.selection,
              }),
            ),
          );
        },
        close: opened.close,
      };
    },
    receive(workbenchId: string, deviceId: string, value: unknown) {
      const frame = nativePresenceLiveSchema.parse(value);
      hub.receive(
        { owner: { workbenchId, extensionId: frame.extensionId }, resourceId: frame.documentKey },
        deviceId,
        frame.action === "upsert"
          ? { action: "upsert", participantId: frame.participantId, value: presenceValue(frame) }
          : frame,
      );
    },
    snapshot(address: Address) {
      const target = addressOf(address);
      return hub
        .snapshot(target)
        .map(({ deviceId, participantId, value }) => ({ ...upsertFrame(target, participantId, value), deviceId }));
    },
    watch: (address: Address, changed: () => void) => hub.watch(addressOf(address), changed),
    expire: hub.expire,
    forgetRemote: hub.forgetRemote,
    republish: hub.republish,
    close: hub.close,
  };
};
