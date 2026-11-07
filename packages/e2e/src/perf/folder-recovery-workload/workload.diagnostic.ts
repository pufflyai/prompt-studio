/**
 * PRD 0015 large folder-recovery workload: one account's laptop captures a fixed 5 GiB folder
 * (one 1 GiB file and eight 512 MiB files) to the packaged wire peer, a second computer downloads
 * it while the laptop is off and restores it through the CLI. Record sync and another account must
 * keep progressing during the transfer. See documentation/references/performance/0008-folder-recovery-workload.md.
 *
 *   bun run build && bun run --cwd scripts build:host
 *   bun packages/e2e/src/perf/folder-recovery-workload/workload.diagnostic.ts [output-directory]
 */
import { randomFillSync } from "node:crypto";
import { mkdir, mkdtemp, open, readdir, rm, statfs } from "node:fs/promises";
import { cpus, release, tmpdir, totalmem } from "node:os";
import { join, resolve } from "node:path";
import type { ProjectFolderRecoveryStatus } from "pstdio-api-contracts";
import { folderProjectInput } from "../../helpers/folder-project";
import {
  type FolderDevice,
  listedCopy,
  ownCopy,
  signInDevice,
  snapshotTree,
  startFolderDevice,
  waitFor,
  writeCertificate,
} from "../../packaged/packaged-folder-recovery.fixture";
import { PACKAGED_BINARY_PATH } from "../../packaged/packaged-helpers";
import { stopProcess } from "../../packaged/packaged-serve-helpers";
import { writeSharedNotesExtension } from "../../packaged/packaged-shared-notes-extension.fixture";
import { createPackagedSyncPeer, packagedAccountCode } from "../../packaged/packaged-sync-relay.fixture";
import { runTestCommand } from "../../scripts/run-test-command";

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;
// The fixed reference: never shrink it or exclude any of it with `.pstignore`.
const workload = [
  { path: "large/one-gib.bin", bytes: GiB },
  ...Array.from({ length: 8 }, (_, index) => ({ path: `parts/part-${index}.bin`, bytes: 512 * MiB })),
];
const totalBytes = workload.reduce((sum, file) => sum + file.bytes, 0);
// At most four copies exist at once: the source, the laptop's encrypted store and the peer's blobs during
// upload; the peer's blobs, the desktop's store, the restored folder and the start of the desktop's own
// capture after the laptop's files are removed. The rest is headroom for other work on the machine.
const requiredFreeBytes = 5 * totalBytes;

const output = resolve(process.argv[2] ?? ".pstdio/extension-storage/pstdio.pstdio-artifacts/folder-recovery-workload");
const root = resolve(import.meta.dir, "../../../../..");
await mkdir(output, { recursive: true });
const logs: string[] = [];
const log = (message: string) => {
  const entry = `${new Date().toISOString()} ${message}`;
  logs.push(entry);
  console.log(entry);
};
const metadata = {
  measuredAt: new Date().toISOString(),
  source: Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: root, stdout: "pipe" }).stdout.toString().trim(),
  dirty: Bun.spawnSync(["git", "status", "--porcelain"], { cwd: root, stdout: "pipe" }).stdout.length > 0,
  binary: process.env.E2E_PACKAGED_BINARY_PATH ?? PACKAGED_BINARY_PATH,
  bun: Bun.version,
  os: release(),
  platform: process.platform,
  arch: process.arch,
  cpu: cpus()[0]?.model,
  cpuCount: cpus().length,
  memoryBytes: totalmem(),
  workload: { files: workload, totalBytes },
  relay: "Packaged wire peer (packaged-sync-relay.fixture) on loopback TLS with disk-backed blobs",
};

/** Peak resident memory of each process, overall and per phase, sampled every 500 ms. */
const sampleMemory = () => {
  const pids = new Map<string, number>();
  const peaks: Record<string, Record<string, number>> = {};
  let phase = "setup";
  const rss = (pid: number) => {
    const result = Bun.spawnSync(["ps", "-o", "rss=", "-p", String(pid)], { stdout: "pipe" });
    return Number(result.stdout.toString().trim()) * 1024 || 0;
  };
  const sample = () => {
    const current = [...pids].map(([name, pid]) => [name, rss(pid)] as const);
    current.push(["runner+peer", process.memoryUsage().rss]);
    for (const [name, bytes] of current)
      for (const key of [phase, "overall"]) {
        peaks[key] ??= {};
        peaks[key][name] = Math.max(peaks[key][name] ?? 0, bytes);
      }
  };
  const timer = setInterval(sample, 500);
  return {
    track: (name: string, pid: number | undefined) => pid && pids.set(name, pid),
    phase: (name: string) => {
      sample();
      phase = name;
    },
    peaks: () => peaks,
    stop: () => clearInterval(timer),
  };
};

const writeSource = async (folder: string) => {
  const block = Buffer.alloc(8 * MiB);
  const digests: Record<string, string> = {};
  for (const file of workload) {
    await mkdir(join(folder, file.path, ".."), { recursive: true });
    const handle = await open(join(folder, file.path), "wx", 0o644);
    const hash = new Bun.CryptoHasher("sha256");
    try {
      for (let written = 0; written < file.bytes; written += block.length) {
        randomFillSync(block);
        hash.update(block);
        await handle.write(block);
      }
    } finally {
      await handle.close();
    }
    digests[file.path] = hash.digest("hex");
  }
  return digests;
};

const command = async <T>(device: FolderDevice, projectId: string, id: string, params: unknown = {}) => {
  const response = await fetch(
    `${device.host.baseUrl}/v1/projects/${projectId}/extensions/commands/example.shared-notes.command.${id}/execute`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${device.host.descriptor.token}`, "content-type": "application/json" },
      body: JSON.stringify({ params }),
    },
  );
  const body = (await response.json()) as { outcome?: { ok: boolean; value: T } };
  if (!response.ok || !body.outcome?.ok) throw new Error(`Command ${id} failed: ${JSON.stringify(body)}`);
  return body.outcome.value;
};
const writeNote = async (device: FolderDevice, projectId: string, value: string) => {
  const records = await command<Record<string, { recordId: string }>>(device, projectId, "read");
  await command(device, projectId, "commit", {
    group: { operationId: `note-${value}`, edits: [{ recordId: records.note!.recordId, replace: value }] },
  });
};
const readNote = async (device: FolderDevice, projectId: string) =>
  (await command<Record<string, { value?: unknown } | null>>(device, projectId, "read").catch(() => null))?.note?.value;

/** Repeats a timed step until stopped; each sample is its latency or a missed deadline. */
const probe = (name: string, step: (index: number) => Promise<void>, everyMs = 3_000, deadlineMs = 120_000) => {
  const samples: { at: string; ms: number | null; error?: string }[] = [];
  let stopped = false;
  const running = (async () => {
    for (let index = 0; !stopped; index++) {
      const started = performance.now();
      const at = new Date().toISOString();
      try {
        await Promise.race([
          step(index),
          Bun.sleep(deadlineMs).then(() => {
            throw new Error(`No progress within ${deadlineMs} ms`);
          }),
        ]);
        samples.push({ at, ms: Math.round(performance.now() - started) });
      } catch (error) {
        samples.push({ at, ms: null, error: error instanceof Error ? error.message : String(error) });
      }
      log(`${name} sample ${index}: ${samples.at(-1)!.ms ?? samples.at(-1)!.error} ms`);
      await Bun.sleep(everyMs);
    }
  })();
  return async () => {
    stopped = true;
    await running;
    const values = samples.flatMap((sample) => (sample.ms === null ? [] : [sample.ms]));
    return {
      samples,
      completed: values.length,
      missed: samples.length - values.length,
      maxMs: values.length ? Math.max(...values) : null,
      medianMs: values.length ? values.sort((a, b) => a - b)[Math.floor(values.length / 2)] : null,
    };
  };
};

const rate = (bytes: number, ms: number) => ({ ms, bytesPerSecond: Math.round(bytes / (ms / 1000)) });

const main = async () => {
  const available = await statfs(tmpdir());
  const freeBytes = available.bavail * available.bsize;
  if (freeBytes < requiredFreeBytes) {
    const blocked = { metadata, freeBytes, requiredFreeBytes, shortfallBytes: requiredFreeBytes - freeBytes };
    await Bun.write(join(output, "blocked.json"), JSON.stringify(blocked, null, 2));
    throw new Error(`Not enough free disk: ${freeBytes} of ${requiredFreeBytes} bytes`);
  }
  const work = await mkdtemp(join(tmpdir(), "folder-recovery-workload-"));
  log(`Working directory ${work}`);
  const memory = sampleMemory();
  const devices: FolderDevice[] = [];
  const peer = await (async () => {
    await mkdir(join(work, "relay-blobs"));
    const tls = writeCertificate(work);
    return {
      tls,
      ...createPackagedSyncPeer({ key: Bun.file(tls.key), cert: Bun.file(tls.cert) }, "127.0.0.1", {
        blobDirectory: join(work, "relay-blobs"),
      }),
    };
  })();
  const results: Record<string, unknown> = {};
  try {
    const folder = join(work, "laptop-project");
    let started = performance.now();
    const digests = await writeSource(folder);
    results.generate = rate(totalBytes, Math.round(performance.now() - started));
    log(`Generated ${totalBytes} bytes`);

    const env = {
      NODE_EXTRA_CA_CERTS: peer.tls.cert,
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
        { source: await writeSharedNotesExtension(work), installName: "shared-notes" },
      ]),
    };
    const [laptop, desktop, other] = await Promise.all(
      ["laptop", "desktop", "other-account"].map((name) => startFolderDevice(join(work, name), env)),
    );
    devices.push(laptop!, desktop!, other!);
    for (const [name, device] of [
      ["laptop", laptop!],
      ["desktop", desktop!],
      ["other-account", other!],
    ] as const)
      memory.track(name, device.host.child.pid);

    // Upload: the laptop captures and uploads while its records and another account keep syncing.
    memory.phase("capture-upload");
    const project = await laptop!.client.projects.create(folderProjectInput({ name: "Large folder" }, folder));
    const laptopDevice = await signInDevice(laptop!, peer.origin);
    started = performance.now();
    const uploadStartedAt = new Date().toISOString();
    await laptop!.client.account.syncProject(project.id);
    const updatesFrom = (device: string) =>
      [...peer.documents.values()].reduce(
        (sum, document) => sum + document.updates.filter((update) => update.deviceId === device).length,
        0,
      );
    // A saved record counts once the relay holds the device's encrypted update.
    const recordProbe = (name: string, device: FolderDevice, deviceId: () => string) =>
      probe(`${name} record`, async (index) => {
        const before = updatesFrom(deviceId());
        await writeNote(device, project.id, `${name}-${index}`);
        await waitFor(() => updatesFrom(deviceId()) > before);
      });
    const recordsDuringUpload = recordProbe("laptop", laptop!, () => laptopDevice);
    const otherFolder = join(work, "other-project");
    await mkdir(otherFolder);
    await Bun.write(join(otherFolder, "notes.md"), "another account");
    const otherProject = await other!.client.projects.create(
      folderProjectInput({ name: "Another account" }, otherFolder),
    );
    await signInDevice(other!, peer.origin, packagedAccountCode("second"));
    await other!.client.account.syncProject(otherProject.id);
    const otherCapture = (phase: string) =>
      probe(`other account ${phase} capture`, async (index) => {
        const before = (await ownCopy(other!, otherProject.id))?.completedAt ?? null;
        await Bun.write(join(otherFolder, `${phase}-${index}.md`), `saved during ${phase}`);
        await other!.client.projects.captureFolder(otherProject.id);
        await waitFor(async () => {
          const copy = await ownCopy(other!, otherProject.id);
          return !!copy && copy.completedAt !== before;
        });
      });
    const otherDuringUpload = otherCapture("upload");
    let copy = await ownCopy(laptop!, project.id);
    while (!copy) {
      await Bun.sleep(1_000);
      copy = await ownCopy(laptop!, project.id);
    }
    const uploadMs = Math.round(performance.now() - started);
    results.captureUpload = {
      ...rate(copy.bytes!, uploadMs),
      startedAt: uploadStartedAt,
      scan: { startedAt: copy.startedAt, completedAt: copy.completedAt },
      scanMs: Date.parse(copy.completedAt!) - Date.parse(copy.startedAt!),
      publishedAt: new Date().toISOString(),
      files: copy.files,
      bytes: copy.bytes,
      records: await recordsDuringUpload(),
      otherAccount: await otherDuringUpload(),
    };
    log(`Laptop copy uploaded in ${uploadMs} ms`);

    // Download: the laptop turns off; a new computer signs in and downloads every byte from Cloud.
    await stopProcess(laptop!.host.child);
    // The laptop is gone: its folder and recovery store leave the disk. Digests verify the restore.
    await rm(folder, { recursive: true, force: true });
    await rm(laptop!.home, { recursive: true, force: true });
    memory.phase("download");
    started = performance.now();
    const desktopDevice = await signInDevice(desktop!, peer.origin);
    await waitFor(async () => !!(await desktop!.client.projects.get(project.id).catch(() => null)));
    await waitFor(async () => (await readNote(desktop!, project.id)) !== undefined);
    const recordsDuringDownload = recordProbe("desktop", desktop!, () => desktopDevice);
    const otherDuringDownload = otherCapture("download");
    await waitFor(async () => {
      const listed = await listedCopy(desktop!, project.id, laptopDevice);
      if (!listed?.available) await Bun.sleep(1_000);
      return !!listed?.available;
    });
    const downloadMs = Math.round(performance.now() - started);
    results.download = {
      ...rate(copy.bytes!, downloadMs),
      blobReads: peer.blobReads().filter((read) => read.deviceId === desktopDevice).length,
      records: await recordsDuringDownload(),
      otherAccount: await otherDuringDownload(),
    };
    log(`Desktop downloaded in ${downloadMs} ms`);

    // Restore through the CLI into a new folder, then verify every byte.
    memory.phase("restore");
    const restored = join(work, "desktop-project");
    started = performance.now();
    const restore = await runTestCommand(
      metadata.binary,
      [
        ...["projects", "folder", "restore", project.id],
        ...["--device", laptopDevice, "--source", copy.sourceId, "--path", restored],
      ],
      {
        cwd: work,
        env: { ...process.env, PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_HOME: desktop!.home },
      },
    ).then((result) => JSON.parse(result.stdout) as ProjectFolderRecoveryStatus);
    const restoreMs = Math.round(performance.now() - started);
    // The restored folder becomes the desktop's own source; stop before it re-uploads 5 GiB.
    await stopProcess(desktop!.host.child);
    memory.phase("verify");
    if (restore.restore.state !== "complete") throw new Error(`Restore failed: ${JSON.stringify(restore.restore)}`);
    const tree = await snapshotTree(restored, (path) => path === ".pstdio" || path === ".pstignore");
    const mismatched = workload.filter((file) => !tree[file.path]?.endsWith(` ${file.bytes} ${digests[file.path]}`));
    results.restore = { ...rate(copy.bytes!, restoreMs), result: restore.restore.result, mismatched };
    if (mismatched.length) throw new Error(`Restored files differ: ${mismatched.map((file) => file.path).join(", ")}`);
    log(`Restored and verified in ${restoreMs} ms`);
  } finally {
    memory.stop();
    results.peakMemoryBytes = memory.peaks();
    await Promise.allSettled([...devices.map((device) => stopProcess(device.host.child)), peer.stop()]);
    log(`Removing ${work} (${(await readdir(work).catch(() => [])).length} entries)`);
    await rm(work, { recursive: true, force: true });
    await Bun.write(join(output, "results.json"), JSON.stringify({ metadata, results }, null, 2));
  }
};

try {
  await main();
} catch (error) {
  log(`FAILED: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
} finally {
  await Bun.write(join(output, "run.log"), logs.join("\n"));
}
