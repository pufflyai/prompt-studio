import assert from "node:assert/strict";
import { join } from "node:path";
import type { Asset } from "pstdio-sync-contracts";
import type { deploy } from "./deployment";
import { createDevice, type OwnerInput, value } from "./device";
import { inspectStorage } from "./inspect";
import { measureDocument } from "./measurements";
import { auditStorage } from "./storage-audit";
import type { observeTraffic } from "./traffic";

type Deployment = Awaited<ReturnType<typeof deploy>>;
type Device = Awaited<ReturnType<typeof createDevice>>;

const closeDevices = async (devices: Device[]) => {
  const results = await Promise.allSettled(devices.map((device) => device.close()));
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length)
    throw new AggregateError(
      failed.map((result) => result.reason),
      "Device cleanup failed",
    );
};

interface ScenarioOwner {
  input: OwnerInput;
  source: Awaited<ReturnType<Device["owner"]>>;
  follower: Awaited<ReturnType<Device["owner"]>>;
  fresh: Awaited<ReturnType<Device["owner"]>>;
  assets: Map<number, Asset>;
}

const workloads = {
  reference: { ownerCount: 2, recordsPerOwner: 5_000, projects: 2, largestAssetBytes: 1024 ** 3 },
  scale: { ownerCount: 10, recordsPerOwner: 10_000, projects: 1, largestAssetBytes: 0 },
};

const uploadWithSecondAccount = async (
  owner: ScenarioOwner,
  other: Device,
  traffic: ReturnType<typeof observeTraffic>,
  account: string,
) => {
  const stream = await other.owner({
    owner: { workbenchId: `${account}-other-project`, extensionId: "pstdio-tests.concurrent-account" },
    secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
    chunks: new Set(),
    frames: new Set(),
    files: new Set(),
  });
  await stream.records.commit({ operationId: "concurrent", edits: [{ recordId: "record-0", replace: value(0) }] });
  const transfer = traffic.nextPart("reference-source");
  const upload = owner.source.sync.synchronize();
  // The overlap operation has its own await; retain this failure until we await the upload below.
  void upload.catch(() => {});
  try {
    const firstPart = await Promise.race([
      transfer,
      upload.then(() => {
        throw new Error("Large upload sent no parts");
      }),
    ]);
    const start = performance.now();
    await stream.sync.synchronize();
    const end = performance.now();
    await upload;
    const parts = traffic.samples.filter(
      (sample) =>
        sample.actor === "reference-source" && sample.operation === "part" && sample.blobId === firstPart.blobId,
    );
    const transferEnd = Math.max(...parts.map((part) => part.startedAt + part.elapsedMs));
    const overlapped = start >= firstPart.startedAt && end <= transferEnd;
    assert(overlapped, "Second account did not sync inside the 1 GiB multipart transfer window");
    await stream.verify(1, false, new Map(), 0);
    return {
      elapsedMs: end - start,
      overlapped,
      largeFilePartRequests: parts.length,
      transferMs: transferEnd - firstPart.startedAt,
    };
  } finally {
    await upload.catch(() => {});
  }
};

const seedOwner = async (peer: ScenarioOwner, count: number) => {
  for (let offset = 0; offset < count; offset += 100) {
    await peer.source.records.commit({
      operationId: `seed-${offset}`,
      edits: Array.from({ length: Math.min(100, count - offset) }, (_, at) => {
        const index = offset + at;
        return {
          recordId: `record-${index}`,
          replace: value(index),
          ...(peer.assets.has(index) && { asset: peer.assets.get(index)! }),
        };
      }),
    });
  }
};

const generateFiles = async (
  source: Device,
  peer: ScenarioOwner,
  ownerIndex: number,
  log: (message: string) => void,
) => {
  const fileCount = ownerIndex === 0 ? 5 : 4;
  for (let index = 0; index < fileCount; index++) {
    const bytes = ownerIndex === 0 && index === 0 ? 1024 ** 3 : 512 * 1024 ** 2;
    log(`reference: generating ${bytes} bytes for project ${ownerIndex}, file ${index}`);
    peer.assets.set(index, await source.files.generate(bytes, ownerIndex * 5 + index));
  }
};

const editOwner = async (owner: ScenarioOwner, records: number, edits: number) => {
  for (let offset = 0; offset < edits; offset += 100) {
    await owner.source.records.commit({
      operationId: `edit-${offset}`,
      edits: Array.from({ length: 100 }, (_, at) => {
        const edit = offset + at;
        const index = edit % records;
        return { recordId: `record-${index}`, replace: value(index, edit) };
      }),
    });
    await owner.source.sync.synchronize();
  }
};

export const runScenario = async (input: {
  name: "reference" | "scale";
  deployment: Deployment;
  directory: string;
  traffic: ReturnType<typeof observeTraffic>;
  log: (message: string) => void;
  units: Map<string, OwnerInput>;
}) => {
  const { name, deployment, traffic, log } = input;
  const baseline = await inspectStorage(deployment.databaseUrl, deployment.s3);
  const reference = name === "reference";
  const { ownerCount, recordsPerOwner, projects, largestAssetBytes } = workloads[name];
  const editsPerOwner = 10_000;
  const account = `${deployment.project}-${name}`;
  const devices: Device[] = [];
  const openDevice = async (suffix: string, deviceAccount = account) => {
    const device = await createDevice({
      name: `${name}-${suffix}`,
      account: deviceAccount,
      directory: join(input.directory, name),
      deployment,
      traffic,
      units: input.units,
    });
    devices.push(device);
    return device;
  };
  const started = performance.now();
  const owners: ScenarioOwner[] = [];
  try {
    const source = await openDevice("source");
    const follower = await openDevice("follower");
    const fresh = await openDevice("fresh");
    for (let ownerIndex = 0; ownerIndex < ownerCount; ownerIndex++) {
      const ownerInput: OwnerInput = {
        owner: {
          workbenchId: reference ? `${account}-project-${ownerIndex}` : `${account}-project`,
          extensionId: `pstdio-tests.cost-owner-${ownerIndex}`,
        },
        secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
        chunks: new Set(),
        frames: new Set(),
        files: new Set(),
      };
      const peers = {
        input: ownerInput,
        source: await source.owner(ownerInput),
        follower: await follower.owner(ownerInput),
        fresh: await fresh.owner(ownerInput),
        assets: new Map<number, Asset>(),
      };
      owners.push(peers);
      if (reference) await generateFiles(source, peers, ownerIndex, log);
      await seedOwner(peers, recordsPerOwner);
      log(`${name}: seeded owner ${ownerIndex + 1}/${ownerCount}, ${recordsPerOwner} records`);
    }
    let secondAccount: Awaited<ReturnType<typeof uploadWithSecondAccount>> | undefined;
    traffic.phase(`${name}/founding`);
    if (reference) {
      const other = await openDevice("second-account", `${account}-other`);
      secondAccount = await uploadWithSecondAccount(owners[0]!, other, traffic, account);
      log(`${name}: second account synced during the large transfer in ${secondAccount.elapsedMs.toFixed(0)} ms`);
    } else await owners[0]!.source.sync.synchronize();
    for (const owner of owners.slice(1)) await owner.source.sync.synchronize();
    traffic.phase(`${name}/initial-follower-download`);
    for (const owner of owners) {
      await owner.follower.sync.synchronize();
      await owner.follower.verify(recordsPerOwner, false, owner.assets, 0);
    }
    log(`${name}: follower verified every initial record and file`);
    const checkpoints = [];
    traffic.phase(`${name}/edits`);
    for (const [ownerIndex, owner] of owners.entries()) {
      await editOwner(owner, recordsPerOwner, editsPerOwner);
      await deployment.cleanup();
      const stored = await inspectStorage(deployment.databaseUrl, deployment.s3);
      const bound = measureDocument(
        stored.rows,
        owner.source.documentId,
        new Set([...owner.input.chunks, ...owner.input.frames]),
      );
      checkpoints.push({ owner: ownerIndex, edits: editsPerOwner, ...bound });
      log(
        `${name}: owner ${ownerIndex + 1}/${ownerCount}, ${editsPerOwner} edits; R23 ${bound.storedBytes}/${bound.limitBytes} bytes (${bound.passed ? "pass" : "FAIL"})`,
      );
    }
    traffic.phase(`${name}/catch-up`);
    for (const owner of owners) {
      await owner.follower.sync.synchronize();
      await owner.follower.verify(recordsPerOwner, true, owner.assets, editsPerOwner);
    }
    // Release this fixture device's files before downloading another full copy on the same disk.
    await follower.files.clear();
    traffic.phase(`${name}/first-download-after-edits`);
    for (const owner of owners) {
      await owner.fresh.sync.synchronize();
      await owner.fresh.verify(recordsPerOwner, true, owner.assets, editsPerOwner);
      await owner.source.verify(recordsPerOwner, true, owner.assets, editsPerOwner);
    }
    await deployment.cleanup();
    const storage = await inspectStorage(deployment.databaseUrl, deployment.s3);
    const audit = auditStorage(storage, input.units);
    const assetBytes = owners.reduce(
      (sum, owner) => sum + [...owner.assets.values()].reduce((bytes, asset) => bytes + asset.byteLength, 0),
      0,
    );
    if (reference) assert.equal(assetBytes, 5 * 1024 ** 3);
    const result = {
      name,
      workload: {
        owners: ownerCount,
        projects,
        devices: 3,
        records: recordsPerOwner * ownerCount,
        editsPerOwner,
        totalEdits: editsPerOwner * ownerCount,
        assetBytes,
        largestAssetBytes,
      },
      secondAccount,
      elapsedMs: performance.now() - started,
      checkpoints,
      storage,
      audit,
      storageIncrement: {
        objects: storage.objects.length - baseline.objects.length,
        objectBytes: storage.objectBytes - baseline.objectBytes,
        tableBytes:
          storage.tables.reduce((sum, table) => sum + table.bytes, 0) -
          baseline.tables.reduce((sum, table) => sum + table.bytes, 0),
      },
      verified: {
        everyRecordOnThreeDevices: true,
        fileDigests: reference,
        secondAccountOverlap: secondAccount?.overlapped ?? null,
      },
      passed: checkpoints.every((checkpoint) => checkpoint.passed) && audit.passed,
    };
    return result;
  } finally {
    await closeDevices(devices);
  }
};
