import {
  type Checkpoint,
  canonicalJson,
  captureSchema,
  coverageResultSchema,
  type RelayOperation,
  receiptSchema,
  relayPath,
  relayReplayResultSchema,
  type Scope,
  snapshotFingerprint,
  snapshotSchema,
} from "pstdio-sync-contracts";
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
  const origin = relayOrigin(input.origin);
  const request = async (operation: RelayOperation, init: RequestInit = {}) => {
    const signal = init.signal ? AbortSignal.any([input.signal, init.signal]) : input.signal;
    signal.throwIfAborted();
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${await waitForToken(input.token, signal)}`);
    const response = await fetch(new URL(relayPath(input.scope, operation), origin), {
      ...init,
      headers,
      signal,
    });
    if (!response.ok && !(operation === "assets/read" && response.status === 404)) {
      await response.body?.cancel();
      if (response.status === 409 || (response.status === 404 && operation === "snapshot"))
        throw new Error(`Resynchronization required (${response.status}): local proposals remain saved`);
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
    acknowledge: async (ack) => coverageResultSchema.parse(await (await request("acknowledge", json(ack))).json()),
    submit: async (mutation) => receiptSchema.parse(await (await request("submit", json(mutation))).json()),
    recover: async (mutation, proof) =>
      receiptSchema.parse(await (await request("recover", json({ mutation, proof }))).json()),
    assets: createRelayAssetAdapter(request, input.signal),
  } satisfies RelayAdapter;
  return {
    ...adapter,
    capture: async () => {
      const capture = captureSchema.parse(await (await request("capture", json({}))).json());
      if (
        canonicalJson(capture.snapshot.scope) !== canonicalJson(input.scope) ||
        capture.snapshotHash !== (await snapshotFingerprint(capture.snapshot))
      )
        throw new Error("Capture differs from its scope or immutable checksum");
      return capture;
    },
    releaseCapture: async (id: string) => {
      await request("captures/release", json({ id }));
    },
    replay: async (after: Checkpoint) =>
      relayReplayResultSchema.parse(await (await request("replay", json(after))).json()),
    initialize: async (publishedRevision: string) =>
      snapshotSchema.parse(await (await request("initialize", json({ publishedRevision }))).json()),
  };
};
