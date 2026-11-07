import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPackagedSyncPeer } from "../packaged/packaged-sync-relay.fixture";
import { configuredContainer } from "./storage-scale-container";
import type { ScaleFixture, ScaleRuntime } from "./storage-scale-runtime";
import { prepareScaleSyncDevices } from "./storage-scale-sync-setup";

export interface ScaleSyncService {
  pid: number;
  control: string;
  environment: Record<string, string>;
  remote: { baseUrl: string; descriptor: ScaleRuntime["descriptor"] };
  remoteHome: string;
  preparedMs: number;
}

export const scaleSyncServicePath = (home: string) => join(home, "sync-fixture", "service.json");

export const readScaleSyncService = (home: string) => {
  const path = scaleSyncServicePath(home);
  if (!existsSync(path)) throw new Error("Prepare the sync service with --prepare-sync before --sync shards");
  const service = JSON.parse(readFileSync(path, "utf8")) as ScaleSyncService;
  try {
    process.kill(service.pid, 0);
  } catch {
    throw new Error("The prepared sync service is no longer running; prepare it again with --prepare-sync");
  }
  return service;
};

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
    "2",
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
  const { key, cert } = certificate(root);
  const container = configuredContainer(home);
  const peer = createPackagedSyncPeer(
    { key: Bun.file(key), cert: Bun.file(cert) },
    container ? "0.0.0.0" : "127.0.0.1",
  );
  const environment = { NODE_EXTRA_CA_CERTS: cert };
  const remoteHome = `${home}-remote`;
  rmSync(remoteHome, { recursive: true, force: true });
  const port = new URL(peer.origin).port;
  const origins = {
    primary: container ? `https://host.docker.internal:${port}` : peer.origin,
    remote: `https://127.0.0.1:${port}`,
  };
  const started = performance.now();
  const remote = await prepareScaleSyncDevices(home, remoteHome, fixture, environment, origins, emit).catch(
    async (error) => {
      await peer.stop();
      rmSync(remoteHome, { recursive: true, force: true });
      throw error;
    },
  );
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
  const service: ScaleSyncService = {
    pid: process.pid,
    control: control.url.origin,
    environment,
    remote: { baseUrl: remote.baseUrl, descriptor: remote.descriptor },
    remoteHome,
    preparedMs: performance.now() - started,
  };
  writeFileSync(scaleSyncServicePath(home), JSON.stringify(service));
  emit({ phase: "sync-service-ready", preparedMs: service.preparedMs });
  const stop = async () => {
    rmSync(scaleSyncServicePath(home), { force: true });
    try {
      await remote.stop();
    } finally {
      control.stop(true);
      await peer.stop();
      rmSync(remoteHome, { recursive: true, force: true });
    }
    process.exit(0);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
};

if (import.meta.main) await serve(process.argv[2]);
