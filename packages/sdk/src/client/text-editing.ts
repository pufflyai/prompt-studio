import type { TextEditingConnectionInfo, TextEditingConnectionInput } from "pstdio-api-contracts";
import type {
  TextEditingError,
  TextEditingEvent,
  TextEditingRequest,
  TextEditingResult,
} from "pstdio-api-contracts/extension-kernel";
import { textEditingFailure } from "../extensions/text-editing-codec";
import type { RequestFn } from "./request";
import { readSseStream } from "./sse";
import { createTextConnectionGuest } from "./text-editing-guest";
export interface TextEditingConnection {
  request<Request extends TextEditingRequest>(input: Request): Promise<TextEditingResult<Request>>;
  watch(input: { signal: AbortSignal; onEvent: (event: TextEditingEvent) => void }): Promise<void>;
  prepareClose(): Promise<void>;
  setActive(active: boolean): Promise<void>;
  disconnect(): Promise<void>;
  guest(): ReturnType<typeof createTextConnectionGuest>;
}
type Reply<T> = { ok: true; value: T } | { ok: false; error: TextEditingError };
const value = <T>(reply: Reply<T>) => {
  if (!reply.ok)
    throw Object.assign(new Error(reply.error.message), reply.error, {
      data: {
        retryable: reply.error.retryable,
        ...(reply.error.cancelledBarrierId ? { cancelledBarrierId: reply.error.cancelledBarrierId } : {}),
      },
    });
  return reply.value ?? undefined;
};
export const createTextTransportClient = (request: RequestFn) => ({
  async connect(input: { projectId: string; scope: TextEditingConnectionInput }): Promise<TextEditingConnection> {
    const base = `/v1/projects/${encodeURIComponent(input.projectId)}/text-editing`;
    const connect = async () =>
      value(await request<Reply<TextEditingConnectionInfo>>(base, { method: "POST", body: input.scope }))!;
    let info = await connect();
    let generation = 0;
    let candidate: TextEditingConnectionInfo | undefined;
    let active = true;
    let participation = Promise.resolve();
    let renewal: Promise<void> | undefined;
    let release: { work?: Promise<void> } | undefined;
    const streams = new Set<AbortController>();
    const renew = async (expired: string) => {
      if (release) throw textEditingFailure("session_closed", "This text connection was disposed");
      if (renewal) return renewal;
      if (expired !== info.token) return;
      renewal = (async () => {
        candidate ??= await connect();
        const next = candidate;
        try {
          let applied = active;
          do {
            applied = active;
            value(
              await request<Reply<void>>(`${base}/active`, {
                method: "POST",
                body: { token: next.token, active: applied },
              }),
            );
          } while (applied !== active);
        } catch (error) {
          if ((error as TextEditingError)?.code === "connection_expired" && candidate === next) candidate = undefined;
          throw error;
        }
        info = next;
        candidate = undefined;
        generation++;
        for (const stream of streams)
          stream.abort(textEditingFailure("connection_reset", "The text connection was renewed", true));
      })().finally(() => {
        renewal = undefined;
      });
      await renewal;
    };
    const call = async <T>(path: string, body = {}) => {
      if (release) throw textEditingFailure("session_closed", "This text connection was disposed");
      const token = info.token;
      try {
        const outcome = await Promise.resolve()
          .then(() => request<Reply<T>>(`${base}/${path}`, { method: "POST", body: { token, ...body } }))
          .then(
            (reply) => ({ reply }),
            (error: unknown) => ({ error }),
          );
        await renewal;
        if (release) throw textEditingFailure("session_closed", "This text connection was disposed");
        if (token !== info.token)
          throw textEditingFailure("connection_reset", "This reply belongs to an earlier text connection", true);
        if ("error" in outcome) throw outcome.error;
        return value(outcome.reply);
      } catch (error) {
        if ((error as TextEditingError)?.code !== "connection_expired") throw error;
        await renew(token);
        throw textEditingFailure("connection_reset", "The text host connection was renewed", true);
      }
    };
    const syncParticipation = () => {
      // Every caller owns its queued work, including a change arriving as the previous request settles.
      participation = participation.catch(() => {}).then(() => call<void>("active", { active }));
      return participation;
    };
    const connection: TextEditingConnection = {
      request: async (input) => (await call("request", { request: input })) as never,
      watch: async (input) => {
        const abort = new AbortController();
        const signal = AbortSignal.any([input.signal, abort.signal]);
        streams.add(abort);
        try {
          await syncParticipation();
          const token = info.token;
          const stream = await request<ReadableStream<Uint8Array>>(`${base}/stream`, {
            method: "POST",
            body: { token },
            signal,
            response: "stream",
          });
          await readSseStream(
            stream,
            (event) => {
              if (event.event === "text" && !signal.aborted && token === info.token && !release)
                input.onEvent(JSON.parse(event.data));
            },
            { signal },
          );
        } finally {
          streams.delete(abort);
        }
      },
      prepareClose: async () => {
        await call("prepare-close");
      },
      setActive: async (next) => {
        active = next;
        try {
          await syncParticipation();
        } catch (error) {
          // The existing watch recovery reapplies this desired state before restoring its stream.
          if (active === next) for (const stream of streams) stream.abort(error);
          throw error;
        }
      },
      disconnect: () => {
        release ??= {};
        const ownership = release;
        ownership.work ??= (async () => {
          for (const stream of streams) stream.abort();
          await renewal?.catch(() => {});
          const tokens = new Set([info.token, candidate?.token]);
          await Promise.all(
            [...tokens]
              .filter((token): token is string => !!token)
              .map(async (token) => {
                try {
                  value(await request<Reply<void>>(`${base}/disconnect`, { method: "POST", body: { token } }));
                } catch (error) {
                  if ((error as TextEditingError)?.code !== "connection_expired") throw error;
                }
                if (candidate?.token === token) candidate = undefined;
              }),
          );
        })().catch((error) => {
          ownership.work = undefined;
          throw error;
        });
        return ownership.work;
      },
      guest: () =>
        createTextConnectionGuest(connection, {
          generation: () => generation,
          closed: () => release !== undefined,
          ensure: syncParticipation,
        }),
    };
    return connection;
  },
});
export type TextEditingTransportClient = ReturnType<typeof createTextTransportClient>;
