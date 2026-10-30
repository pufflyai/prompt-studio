import type { TextEditingConnectionInfo, TextEditingConnectionInput } from "pstdio-api-contracts";
import type {
  TextEditingError,
  TextEditingEvent,
  TextEditingRequest,
  TextEditingResult,
} from "pstdio-api-contracts/extension-kernel";
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
    throw Object.assign(new Error(reply.error.message), reply.error, { data: { retryable: reply.error.retryable } });
  return reply.value ?? undefined;
};
export const createTextTransportClient = (request: RequestFn) => ({
  async connect(input: { projectId: string; scope: TextEditingConnectionInput }): Promise<TextEditingConnection> {
    const base = `/v1/projects/${encodeURIComponent(input.projectId)}/text-editing`;
    const info = value(await request<Reply<TextEditingConnectionInfo>>(base, { method: "POST", body: input.scope }))!;
    const call = async <T>(path: string, body = {}) =>
      value(await request<Reply<T>>(`${base}/${path}`, { method: "POST", body: { token: info.token, ...body } }));
    const connection: TextEditingConnection = {
      request: async (input) => (await call("request", { request: input })) as never,
      watch: async (input) => {
        const stream = await request<ReadableStream<Uint8Array>>(`${base}/stream`, {
          method: "POST",
          body: { token: info.token },
          signal: input.signal,
          response: "stream",
        });
        await readSseStream(
          stream,
          (event) => {
            if (event.event === "text") input.onEvent(JSON.parse(event.data));
          },
          { signal: input.signal },
        );
      },
      prepareClose: async () => {
        await call("prepare-close");
      },
      setActive: async (active) => {
        await call("active", { active });
      },
      disconnect: async () => {
        await call("disconnect");
      },
      guest: () => createTextConnectionGuest(connection),
    };
    return connection;
  },
});
export type TextEditingTransportClient = ReturnType<typeof createTextTransportClient>;
