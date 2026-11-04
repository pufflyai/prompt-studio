import {
  deviceCommandChallengeSchema,
  deviceCommandReceivedSchema,
  deviceCommandReplySchema,
  deviceCommandRequestSchema,
  type Json,
  jsonSchema,
} from "pstdio-sync-contracts";
import { openDeviceCall, type SyncSpace, sealDeviceCall } from "../encryption";
import { decodeBytes, encodeBytes } from "../shared";
import { createDeviceCommandAuthorization } from "./device-command-authorization";
import type { LiveConnection } from "./live";

type DeviceIdentity = { accountId: string; deviceId: string; key: CryptoKey };
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes));
// Two base64 layers plus signatures and encryption fit inside the relay's 64 KiB frame.
const resultChunkBytes = 12 * 1024;

/** The existing project socket carries calls; no command or reply is persisted or queued. */
export const createDeviceCommandChannel = (input: {
  live: LiveConnection;
  space: () => Promise<SyncSpace>;
  identity: () => Promise<DeviceIdentity>;
  trustedKey: (deviceId: string) => Promise<CryptoKey>;
  execute: (command: Json, context: { signal: AbortSignal; partial: (result: Json) => Promise<void> }) => Promise<Json>;
}) => {
  let closed = false;
  const authorization = createDeviceCommandAuthorization();
  const active = new Set<Promise<unknown>>();
  const stop = input.live.listen((event) => {
    if (event.type === "disconnected") authorization.clear();
  });
  let unregister = () => {};
  const context = async () => {
    if (closed) throw new Error("Device commands closed");
    const [space, identity] = await Promise.all([input.space(), input.identity()]);
    if (space.spaceOwner !== identity.accountId) throw new Error("Device commands require the owner's private space");
    const procedure = await space.documentId("pstdio.device-commands.v1");
    if (closed) throw new Error("Device commands closed");
    return { space, identity, procedure };
  };
  const ready = context().then(({ space, procedure }) => {
    const handler: Parameters<LiveConnection["register"]>[1] = async (event, signal, partial) => {
      const current = await context();
      if (event.spaceOwner !== current.space.spaceOwner || event.procedure !== current.procedure)
        throw new Error("Device command scope changed");
      const call = { callerDeviceId: event.deviceId, targetDeviceId: current.identity.deviceId, procedure };
      const trusted = await input.trustedKey(event.deviceId);
      const request = deviceCommandRequestSchema.parse(
        decode(await openDeviceCall(current.space, call, trusted, event.payload)),
      );
      signal.throwIfAborted();
      const response = { callerDeviceId: call.targetDeviceId, targetDeviceId: call.callerDeviceId, procedure };
      let sequence = 0;
      let pending = Promise.resolve();
      const send = (frame: Json, index: number) =>
        sealDeviceCall(
          current.space,
          response,
          current.identity.key,
          encode({ requestId: request.requestId, sequence: index, ...(frame as object) }),
        );
      const execution = {
        signal,
        partial: (value: Json) => {
          const index = sequence++;
          pending = pending.then(async () => {
            signal.throwIfAborted();
            partial(await send({ kind: "progress", result: jsonSchema.parse(value) }, index));
          });
          // A caller may leave before the operation completes; its turn is owned by the runtime, not this call.
          void pending.catch(() => {});
          return pending;
        },
      };
      let result: Json;
      if (request.kind === "challenge") result = authorization.issue(event.deviceId);
      else {
        const received = authorization.append(
          event.deviceId,
          request.challenge,
          request.offset,
          decodeBytes(request.chunk),
          request.final,
        );
        result = received.complete
          ? await input.execute(jsonSchema.parse(decode(received.bytes)), execution)
          : { received: received.received };
      }
      await pending;
      const bytes = encode(jsonSchema.parse(result));
      for (let offset = 0; offset < bytes.byteLength; offset += resultChunkBytes) {
        signal.throwIfAborted();
        const payload = await send(
          { kind: "result", chunk: encodeBytes(bytes.subarray(offset, offset + resultChunkBytes)) },
          sequence++,
        );
        if (offset + resultChunkBytes >= bytes.byteLength) return payload;
        partial(payload);
      }
      throw new Error("Missing device result");
    };
    unregister = input.live.register({ spaceOwner: space.spaceOwner, topic: procedure }, (...args) => {
      const pending = handler(...args);
      active.add(pending);
      void pending.finally(() => active.delete(pending)).catch(() => {});
      return pending;
    });
  });
  // Owners can start while the manager is offline. Callers still observe the original failure through ready.
  void ready.catch(() => {});
  const invoke = async (
    deviceId: string,
    body: { kind: "challenge" } | { kind: "command"; challenge: string; offset: number; chunk: string; final: boolean },
    options: { signal: AbortSignal; partial?: (result: Json) => void },
  ) => {
    options.signal.throwIfAborted();
    const { space, identity, procedure } = await context();
    const requestId = crypto.randomUUID();
    const payload = await sealDeviceCall(
      space,
      { callerDeviceId: identity.deviceId, targetDeviceId: deviceId, procedure },
      identity.key,
      encode({ requestId, ...body }),
    );
    let sequence = 0;
    let receiving = Promise.resolve();
    let failure: unknown;
    const chunks: Uint8Array[] = [];
    let trusted: Promise<CryptoKey> | undefined;
    const read = async (payload: string) => {
      trusted ??= input.trustedKey(deviceId);
      const key = await trusted;
      const reply = deviceCommandReplySchema.parse(
        decode(
          await openDeviceCall(
            space,
            { callerDeviceId: deviceId, targetDeviceId: identity.deviceId, procedure },
            key,
            payload,
          ),
        ),
      );
      if (reply.requestId !== requestId || reply.sequence !== sequence++)
        throw new Error("Device reply does not match its call");
      return reply;
    };
    const result = await input.live.call({
      deviceId,
      spaceOwner: space.spaceOwner,
      procedure,
      payload,
      signal: options.signal,
      partial: (payload) => {
        receiving = receiving
          .then(async () => {
            const reply = await read(payload);
            if (reply.kind === "progress") options.partial?.(reply.result);
            else chunks.push(decodeBytes(reply.chunk));
          })
          .catch((error) => {
            failure ??= error;
          });
      },
    });
    await receiving;
    if (failure) throw failure;
    const reply = await read(result);
    if (reply.kind !== "result") throw new Error("Missing device result");
    chunks.push(decodeBytes(reply.chunk));
    const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return jsonSchema.parse(decode(bytes));
  };
  return {
    ready,
    close() {
      closed = true;
      unregister();
      authorization.clear();
      stop();
    },
    async drain() {
      await ready.catch(() => {});
      await Promise.allSettled([...active]);
    },
    async call(deviceId: string, command: Json, options: { signal: AbortSignal; partial?: (result: Json) => void }) {
      const grant = deviceCommandChallengeSchema.parse(
        await invoke(deviceId, { kind: "challenge" }, { signal: options.signal }),
      );
      const bytes = encode(jsonSchema.parse(command));
      for (let offset = 0; offset < bytes.byteLength; offset += resultChunkBytes) {
        const final = offset + resultChunkBytes >= bytes.byteLength;
        const result = await invoke(
          deviceId,
          {
            kind: "command",
            challenge: grant.challenge,
            offset,
            chunk: encodeBytes(bytes.subarray(offset, offset + resultChunkBytes)),
            final,
          },
          options,
        );
        if (final) return result;
        if (deviceCommandReceivedSchema.parse(result).received !== offset + resultChunkBytes)
          throw new Error("Device command chunk was not accepted");
      }
      throw new Error("Missing device command");
    },
  };
};
