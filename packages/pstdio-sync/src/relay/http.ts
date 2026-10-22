import { type RelayOperation, receiptSchema, relayPath, type Scope, snapshotSchema } from "pstdio-sync-contracts";
import type { RelayAdapter } from "../types";
import { createRelayAssetAdapter } from "./assets";

export interface RelayHttpInput {
  origin: string;
  scope: Scope;
  token: () => Promise<string>;
  signal: AbortSignal;
}

// A service may run under a path of a shared address, such as https://base.prompt.studio/relay.
export const serviceAddress = (input: string) => {
  const url = new URL(input);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname))
    )
  )
    throw new Error("Invalid service address");
  return url.href.replace(/\/+$/, "");
};

// Service routes are absolute paths; resolve them under the address path, not at its origin.
export const serviceUrl = (address: string, path: string) =>
  new URL(path.replace(/^\/+/, ""), `${serviceAddress(address)}/`);

const waitForToken = async (token: () => Promise<string>, signal: AbortSignal) => {
  signal.throwIfAborted();
  const cancelled = Promise.withResolvers<never>();
  const abort = () => cancelled.reject(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  try {
    // Renewal may be shared by other owners; release only this request's wait.
    return await Promise.race([token(), cancelled.promise]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
};

export const createRelayAdapter = (input: RelayHttpInput) => {
  const address = serviceAddress(input.origin);
  const request = async (operation: RelayOperation, init: RequestInit = {}) => {
    const signal = init.signal ? AbortSignal.any([input.signal, init.signal]) : input.signal;
    signal.throwIfAborted();
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${await waitForToken(input.token, signal)}`);
    const response = await fetch(serviceUrl(address, relayPath(input.scope, operation)), {
      ...init,
      headers,
      signal,
    });
    if (!response.ok && !(operation === "assets/read" && response.status === 404)) {
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
    recover: async (mutation, proof) =>
      receiptSchema.parse(await (await request("recover", json({ mutation, proof }))).json()),
    assets: createRelayAssetAdapter(request, input.signal),
  } satisfies RelayAdapter;
  return {
    ...adapter,
    initialize: async (publishedRevision: string) =>
      snapshotSchema.parse(await (await request("initialize", json({ publishedRevision }))).json()),
  };
};
