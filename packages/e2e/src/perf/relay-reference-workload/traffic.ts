import { syncRoute } from "pstdio-sync-contracts";

interface RequestSample {
  actor: string;
  phase: string;
  operation: string;
  status: number;
  sentBytes: number;
  receivedBytes: number;
  elapsedMs: number;
  startedAt: number;
  blobId: string | null;
}

export const observeTraffic = (origin: string) => {
  const original = globalThis.fetch;
  const actors = new Map<string, string>();
  const samples: RequestSample[] = [];
  const partWaiters = new Map<string, (sample: RequestSample) => void>();
  let phase = "setup";
  const wrapped: typeof fetch = Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith(`${origin}/`)) return original(input, init);
    const route = syncRoute(new URL(url).pathname);
    const operation = route && "operation" in route ? `${route.kind}/${route.operation}` : (route?.kind ?? "health");
    const body = init?.body;
    let sentBytes = 0;
    if (typeof body === "string") sentBytes = Buffer.byteLength(body);
    else if (ArrayBuffer.isView(body)) sentBytes = body.byteLength;
    const sample = {
      actor: actors.get(new Headers(init?.headers).get("authorization") ?? "") ?? "unknown",
      phase,
      operation,
      status: 0,
      sentBytes,
      receivedBytes: 0,
      elapsedMs: 0,
      startedAt: performance.now(),
      blobId: route && "blobId" in route ? route.blobId : null,
    };
    samples.push(sample);
    if (route?.kind === "part") {
      partWaiters.get(sample.actor)?.(sample);
      partWaiters.delete(sample.actor);
    }
    const start = performance.now();
    const response = await original(input, init);
    sample.status = response.status;
    sample.elapsedMs = performance.now() - start;
    const received = response.body?.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          sample.receivedBytes += chunk.byteLength;
          controller.enqueue(chunk);
        },
        flush() {
          sample.elapsedMs = performance.now() - start;
        },
      }),
    );
    return new Response(received, { status: response.status, headers: response.headers });
  }, original);
  globalThis.fetch = wrapped;
  return {
    phase: (name: string) => {
      phase = name;
    },
    actor: (token: string, name: string) => actors.set(`Bearer ${token}`, name),
    samples,
    nextPart: (actor: string) => new Promise<RequestSample>((resolve) => partWaiters.set(actor, resolve)),
    summary() {
      const groups = new Map<
        string,
        {
          actor: string;
          phase: string;
          operation: string;
          requests: number;
          sentBytes: number;
          receivedBytes: number;
          failures: number;
        }
      >();
      for (const row of samples) {
        const key = JSON.stringify([row.actor, row.phase, row.operation]);
        const group = groups.get(key) ?? {
          actor: row.actor,
          phase: row.phase,
          operation: row.operation,
          requests: 0,
          sentBytes: 0,
          receivedBytes: 0,
          failures: 0,
        };
        group.requests++;
        group.sentBytes += row.sentBytes;
        group.receivedBytes += row.receivedBytes;
        if (row.status < 200 || row.status >= 300) group.failures++;
        groups.set(key, group);
      }
      return [...groups.values()];
    },
    close: () => {
      globalThis.fetch = original;
    },
  };
};
