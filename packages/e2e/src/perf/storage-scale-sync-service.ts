import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import { createPackagedSyncPeer } from "../packaged/packaged-sync-relay.fixture";
import { configuredContainer } from "./storage-scale-container";
import type { ScaleFixture, ScaleRuntime } from "./storage-scale-runtime";
import { prepareScaleSyncDevices } from "./storage-scale-sync-setup";

export interface ScaleSyncService {
  state: "preparing" | "ready";
  pid: number;
  /** The compiled runtime the second device runs; cases must use the same build. */
  binarySha256: string;
  control: string;
  environment: Record<string, string>;
  remote: { baseUrl: string; descriptor: ScaleRuntime["descriptor"] };
  remoteHome: string;
  preparedMs: number;
}

export const scaleSyncServicePath = (home: string) => join(home, "sync-fixture", "service.json");

export const readScaleSyncServiceState = (home: string) =>
  (JSON.parse(readFileSync(scaleSyncServicePath(home), "utf8")) as Pick<ScaleSyncService, "state">).state;

export const readScaleSyncService = (home: string) => {
  const path = scaleSyncServicePath(home);
  if (!existsSync(path)) throw new Error("Prepare the sync service with --prepare-sync before --sync shards");
  const service = JSON.parse(readFileSync(path, "utf8")) as ScaleSyncService;
  try {
    process.kill(service.pid, 0);
  } catch {
    throw new Error("The prepared sync service is no longer running; run --stop-sync, then --prepare-sync");
  }
  if (service.state !== "ready") throw new Error("The sync service is still preparing");
  if (service.binarySha256 !== binarySha256())
    throw new Error("The sync service runs another runtime build; run --stop-sync, then --prepare-sync");
  return service;
};

const binarySha256 = () => createHash("sha256").update(readFileSync(PACKAGED_BINARY_PATH)).digest("hex");

const certificate = (root: string) => {
  const key = join(root, "peer-key.pem");
  const cert = join(root, "peer-cert.pem");
  const generated = Bun.spawnSync([
    "openssl",
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    cert,
    "-days",
    "30",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=IP:127.0.0.1,DNS:localhost,DNS:host.docker.internal",
  ]);
  if (generated.exitCode !== 0) throw new Error("Creating isolated sync certificate failed");
  return { key, cert };
};

// Preparation that outlives one case: a local TLS relay and a second full device that has
// downloaded the whole fixture. Sync shards attach to it, so each measured case starts with
// both devices already synced, as the corrected case boundary requires.
const serve = async (home: string) => {
  const emit = (row: object) => console.log(JSON.stringify(row));
  const fixture = JSON.parse(readFileSync(join(home, "scale-project.json"), "utf8")) as ScaleFixture;
  const root = join(home, "sync-fixture");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const record = (service: Partial<ScaleSyncService>) =>
    writeFileSync(
      scaleSyncServicePath(home),
      JSON.stringify({ pid: process.pid, binarySha256: binarySha256(), ...service }),
    );
  record({ state: "preparing" });
  // Everything this process started is stopped on a signal, during preparation as well.
  const owned: (() => Promise<void> | void)[] = [];
  const stop = async () => {
    for (const close of owned.reverse()) await Promise.resolve(close()).catch(() => {});
    process.exit(0);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  const { key, cert } = certificate(root);
  const container = configuredContainer(home);
  const peer = createPackagedSyncPeer(
    { key: Bun.file(key), cert: Bun.file(cert) },
    container ? "0.0.0.0" : "127.0.0.1",
  );
  owned.push(() => peer.stop());
  const environment = { NODE_EXTRA_CA_CERTS: cert };
  const remoteHome = `${home}-remote`;
  rmSync(remoteHome, { recursive: true, force: true });
  owned.push(() => rmSync(remoteHome, { recursive: true, force: true }));
  const port = new URL(peer.origin).port;
  const origins = {
    primary: container ? `https://host.docker.internal:${port}` : peer.origin,
    remote: `https://127.0.0.1:${port}`,
  };
  const started = performance.now();
  const remote = await prepareScaleSyncDevices(home, remoteHome, fixture, environment, origins, emit, (runtime) =>
    owned.push(() => runtime.stop()),
  ).catch(async (error) => {
    console.error(error);
    await stop();
    throw error;
  });
  // Cases observe and drive the relay through this local control endpoint.
  const control = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/reads") return Response.json(peer.reads());
      if (path === "/states") return Response.json(peer.states());
      if (path === "/announce-unchanged" && request.method === "POST") {
        peer.announceUnchanged();
        return Response.json({ ok: true });
      }
      return new Response(null, { status: 404 });
    },
  });
  owned.push(() => control.stop(true));
  const preparedMs = performance.now() - started;
  record({
    state: "ready",
    control: control.url.origin,
    environment,
    remote: { baseUrl: remote.baseUrl, descriptor: remote.descriptor },
    remoteHome,
    preparedMs,
  });
  emit({ phase: "sync-service-ready", preparedMs });
};

if (import.meta.main) await serve(process.argv[2]);
