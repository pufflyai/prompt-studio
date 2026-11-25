import { createMetricRegistry } from "pstdio-service-telemetry";
import { createSyncId, openLive, sealLive } from "pstdio-sync/encryption";
import {
  createDocumentRelay,
  createLiveConnection,
  createRelayAccess,
  fetchSyncSpaces,
  type LiveEvent,
  serviceAddress,
  serviceUrl,
} from "pstdio-sync/relay";
import { createCheckpoint } from "./checkpoint";
import { readBounded } from "./io";
import type { ProbeConfig } from "./probe-config";
import { blobRound, syncRound } from "./probe-data";

const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
export const createProbe = async (config: ProbeConfig) => {
  const metrics = createMetricRegistry("pstdio_relay", { environment: config.environment });
  const journal = await createCheckpoint(config.checkpointDirectory, () => ({
    version: 1,
    documentId: createSyncId(),
    lastBlobAt: 0,
    lastMultipartAt: 0,
  }));
  const { state } = journal;
  const observe = async (check: string, action: () => Promise<void>) => {
    const begin = performance.now();
    try {
      await action();
      metrics.set("check_success", 1, { check });
    } catch {
      metrics.set("check_success", 0, { check });
      metrics.add("probe_failures_total", 1, { check });
    } finally {
      metrics.set("check_observed_timestamp_seconds", Date.now() / 1000, { check });
      metrics.set("probe_duration_seconds", (performance.now() - begin) / 1000, { check });
    }
  };
  const queryBudget = async (signal: AbortSignal) => {
    const selector = `{environment="${config.environment}",account="monitoring"}`;
    const query = `pstdio_relay_account_storage_bytes${selector} and on(environment,account) (time() - pstdio_relay_account_observed_timestamp_seconds${selector} < 1200) and on(environment,account) (pstdio_relay_account_observation_success${selector} == 1)`;
    const url = new URL("prometheus/api/v1/query", `${config.budget.queryOrigin.replace(/\/$/, "")}/`);
    url.search = new URLSearchParams({ query }).toString();
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${config.budget.readToken}` },
      signal,
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel();
      return undefined;
    }
    const body = JSON.parse(new TextDecoder().decode(await readBounded(response.body, undefined, signal))) as {
      data?: { result?: { value?: [number, string] }[] };
    };
    const rows = body.data?.result;
    if (rows?.length !== 1) return undefined;
    const used = Number(rows[0]?.value?.[1]);
    return Number.isFinite(used) && used >= 0 ? used : undefined;
  };
  const run = async (signal: AbortSignal) => {
    metrics.set("probe_budget_observation_success", 0);
    await observe("http", async () => {
      const response = await fetch(serviceUrl(serviceAddress(config.relayOrigin), "/health"), {
        signal,
        redirect: "error",
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error("HTTP unavailable");
    });
    const access = config.devices.map((device) =>
      createRelayAccess({
        managerOrigin: config.managerOrigin,
        renewalGrant: device.renewalGrant,
        workbenchId: config.workbenchId,
        signal,
      }),
    );
    let spaces: Awaited<ReturnType<typeof fetchSyncSpaces>>[] = [];
    let authenticated = false;
    await observe("access", async () => {
      spaces = await Promise.all(
        config.devices.map((device) =>
          fetchSyncSpaces({
            managerOrigin: config.managerOrigin,
            credential: device.credential,
            accountId: config.accountId,
            workbenchId: config.workbenchId,
            signal,
          }),
        ),
      );
      await Promise.all(access.map((renew) => renew()));
      authenticated = true;
    });
    if (!authenticated) {
      unavailable(metrics, ["sync", "blobs", "live"]);
      return;
    }
    const [a, b] = spaces.map(({ project }) => project);
    const [writer, reader] = spaces.map(({ project }, index) =>
      createDocumentRelay({
        origin: config.relayOrigin,
        space: project,
        documentId: state.documentId,
        token: async () => (await access[index]!()).token,
        signal,
      }),
    );
    const used = await queryBudget(signal).catch(() => undefined);
    const multipart = Date.now() - state.lastMultipartAt > 7 * 86_400_000;
    const blobDue = Date.now() - state.lastBlobAt > 15 * 60_000;
    const writeAllowance = multipart ? 6 * 1024 ** 2 : 8192;
    const budgetAvailable = used !== undefined && used + writeAllowance + 1024 ** 2 < config.budget.maximumBytes;
    metrics.set("probe_budget_available", budgetAvailable ? 1 : 0);
    metrics.set("probe_budget_observation_success", used === undefined ? 0 : 1);
    if (used !== undefined) metrics.set("probe_budget_used_percent", (used / config.budget.maximumBytes) * 100);
    if (budgetAvailable) {
      const input = { a: a!, b: b!, writer: writer!, reader: reader!, journal };
      await observe("sync", () => syncRound(input));
      if (blobDue || state.pendingBlob) await observe("blobs", () => blobRound(input, multipart));
    } else unavailable(metrics, ["sync", "blobs"]);
    await observe("live", async () => {
      const sockets = access.map((get) =>
        createLiveConnection({ origin: config.relayOrigin, projectId: config.workbenchId, access: get, signal }),
      );
      try {
        const wait = (index: number, test: (event: LiveEvent) => boolean) =>
          new Promise<LiveEvent>((resolve, reject) => {
            const abort = () => {
              release();
              reject(new Error("Live observation interrupted"));
            };
            const release = () => {
              unsubscribe();
              signal.removeEventListener("abort", abort);
            };
            const unsubscribe = sockets[index]!.listen((event) => {
              if (test(event)) {
                release();
                resolve(event);
              }
            });
            signal.addEventListener("abort", abort, { once: true });
            if (signal.aborted) abort();
          });
        const topic = { spaceOwner: null, topic: "monitoring-canary" };
        const ready = sockets.map((_, index) =>
          wait(index, (event) => event.type === "subscribed" && event.topic === topic.topic),
        );
        for (const socket of sockets) socket.subscribe(topic);
        await Promise.all(ready);
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const sealed = await sealLive(a!, config.devices[0].deviceId, topic.topic, bytes);
        const received = wait(
          1,
          (event) =>
            event.type === "event" && event.deviceId === config.devices[0].deviceId && event.topic === topic.topic,
        );
        sockets[0]!.publish(topic, sealed.payload);
        const event = await received;
        if (event.type !== "event" || hash(await openLive(b!, event)) !== hash(bytes))
          throw new Error("Live integrity failed");
      } finally {
        for (const socket of sockets) socket.close();
        await Promise.all(sockets.map((socket) => socket.done));
      }
    });
    metrics.set("prober_heartbeat_timestamp_seconds", Date.now() / 1000);
  };
  return {
    metrics,
    async run(signal: AbortSignal) {
      try {
        await run(signal);
      } finally {
        metrics.set("prober_heartbeat_timestamp_seconds", Date.now() / 1000);
      }
    },
  };
};

const unavailable = (metrics: ReturnType<typeof createMetricRegistry>, checks: string[]) => {
  for (const check of checks) metrics.set("check_success", -1, { check });
};
