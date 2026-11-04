import {
  deviceCommandChallengeSchema,
  deviceCommandInputLimit,
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
export class DeviceCommandInputError extends Error {
  constructor() {
    super(
      "The complete remote action must fit within 64 MiB, including base64-encoded attachments. Send fewer or smaller files.",
    );
  }
}
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes));
// Two base64 layers plus signatures and encryption fit inside the relay's 64 KiB frame.
const resultChunkBytes = 12 * 1024;

const track = <T>(active: Set<Promise<unknown>>, pending: Promise<T>) => {
  active.add(pending);
  void pending.finally(() => active.delete(pending)).catch(() => {});
  return pending;
};

const resolveDeviceAccess = async (
  spaceLookup: (signal: AbortSignal) => Promise<SyncSpace>,
  identityLookup: (signal: AbortSignal) => Promise<DeviceIdentity>,
  signal: AbortSignal,
) => {
  const failure = new AbortController();
  const cancellation = AbortSignal.any([signal, failure.signal]);
  const abort = (error: unknown): never => {
    failure.abort(error);
    throw error;
  };
  // Cancel a failed lookup's sibling, but retain ownership until any uncancellable database reads settle.
  const [space, identity] = await Promise.allSettled([
    Promise.resolve()
      .then(() => spaceLookup(cancellation))
      .catch(abort),
    Promise.resolve()
      .then(() => identityLookup(cancellation))
      .catch(abort),
  ]);
  if (space.status === "rejected") throw space.reason;
  if (identity.status === "rejected") throw identity.reason;
  return { space: space.value, identity: identity.value };
};

/** The existing project socket carries calls; no command or reply is persisted or queued. */
export const createDeviceCommandChannel = (input: {
  live: LiveConnection;
  space: (signal: AbortSignal) => Promise<SyncSpace>;
  identity: (signal: AbortSignal) => Promise<DeviceIdentity>;
  trustedKey: (deviceId: string, signal: AbortSignal) => Promise<CryptoKey>;
  execute: (command: Json, context: { signal: AbortSignal; partial: (result: Json) => Promise<void> }) => Promise<Json>;
}) => {
  let closed = false;
  const shutdown = new AbortController();
  const authorization = createDeviceCommandAuthorization();
  const active = new Set<Promise<unknown>>();
  const stop = input.live.listen((event) => {
    if (event.type === "disconnected") authorization.clear();
  });
  let unregister = () => {};
  const context = async (signal = shutdown.signal) => {
    if (closed) throw new Error("Device commands closed");
    const cancellation = AbortSignal.any([shutdown.signal, signal]);
    const { space, identity } = await resolveDeviceAccess(input.space, input.identity, cancellation);
    if (space.spaceOwner !== identity.accountId) throw new Error("Device commands require the owner's private space");
    const procedure = await space.documentId("pstdio.device-commands.v1");
    if (closed) throw new Error("Device commands closed");
    return { space, identity, procedure };
  };
  const ready = context().then(({ space, procedure }) => {
    const handler: Parameters<LiveConnection["register"]>[1] = async (event, signal, partial) => {
      const current = await context(signal);
      if (event.spaceOwner !== current.space.spaceOwner || event.procedure !== current.procedure)
        throw new Error("Device command scope changed");
      const call = { callerDeviceId: event.deviceId, targetDeviceId: current.identity.deviceId, procedure };
      const trusted = await input.trustedKey(event.deviceId, AbortSignal.any([signal, shutdown.signal]));
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
    unregister = input.live.register({ spaceOwner: space.spaceOwner, topic: procedure }, (...args) =>
      track(active, handler(...args)),
    );
  });
  // Owners can start while the manager is offline. Callers still observe the original failure through ready.
  void ready.catch(() => {});
  const invoke = async (
    deviceId: string,
    body: { kind: "challenge" } | { kind: "command"; challenge: string; offset: number; chunk: string; final: boolean },
    options: { signal: AbortSignal; partial?: (result: Json) => void },
  ) => {
    const signal = AbortSignal.any([options.signal, shutdown.signal]);
    signal.throwIfAborted();
    const { space, identity, procedure } = await context(signal);
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
      trusted ??= input.trustedKey(deviceId, signal);
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
    let result: string;
    try {
      result = await input.live.call({
        deviceId,
        spaceOwner: space.spaceOwner,
        procedure,
        payload,
        signal,
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
    } finally {
      // A transport abort must not release the database while a queued reply-key read is still settling.
      await receiving;
    }
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
  const call = async (
    deviceId: string,
    command: Json,
    options: { signal: AbortSignal; partial?: (result: Json) => void },
  ) => {
    if (closed) throw new Error("Device commands closed");
    options.signal.throwIfAborted();
    const bytes = encode(jsonSchema.parse(command));
    if (bytes.byteLength > deviceCommandInputLimit) throw new DeviceCommandInputError();
    const grant = deviceCommandChallengeSchema.parse(
      await invoke(deviceId, { kind: "challenge" }, { signal: options.signal }),
    );
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
  };
  return {
    ready,
    close() {
      closed = true;
      shutdown.abort();
      unregister();
      authorization.clear();
      stop();
    },
    async drain() {
      await ready.catch(() => {});
      await Promise.allSettled([...active]);
    },
    call: (...args: Parameters<typeof call>) => track(active, call(...args)),
  };
};
