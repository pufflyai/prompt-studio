import { type RelayOperation, receiptSchema, relayPath, type Scope, snapshotSchema } from "pstdio-sync-contracts";
import type { RelayAdapter } from "../types";
import { createRelayAssetAdapter } from "./assets";

export interface RelayHttpInput {
  origin: string;
  scope: Scope;
  token: () => Promise<string>;
  signal: AbortSignal;
}

export const relayOrigin = (input: string) => {
  const url = new URL(input);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname))
    )
  )
    throw new Error("Invalid relay origin");
  return url.origin;
};

export const createRelayAdapter = (input: RelayHttpInput) => {
  const origin = relayOrigin(input.origin);
  const request = async (operation: RelayOperation, init: RequestInit = {}) => {
    input.signal.throwIfAborted();
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${await input.token()}`);
    const response = await fetch(new URL(relayPath(input.scope, operation), origin), {
      ...init,
      headers,
      signal: init.signal ? AbortSignal.any([input.signal, init.signal]) : input.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Relay request failed (${response.status})`);
    }
    return response;
  };
  const json = (body: unknown) => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const adapter = {
    scope: input.scope,
    snapshot: async () => snapshotSchema.parse(await (await request("snapshot")).json()),
    submit: async (mutation) => receiptSchema.parse(await (await request("submit", json(mutation))).json()),
    assets: createRelayAssetAdapter(request, input.signal),
  } satisfies RelayAdapter;
  return {
    ...adapter,
    initialize: async (publishedRevision: string) =>
      snapshotSchema.parse(await (await request("initialize", json({ publishedRevision }))).json()),
  };
};
