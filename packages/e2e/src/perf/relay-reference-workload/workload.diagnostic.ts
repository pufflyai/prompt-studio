import { mkdir, readdir, rm } from "node:fs/promises";
import { cpus, release, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { deploy } from "./deployment";
import type { OwnerInput } from "./device";
import { runScenario } from "./scenario";
import { observeTraffic } from "./traffic";

const output = resolve(process.argv[2] ?? ".pstdio/extension-storage/pstdio.pstdio-artifacts/ps787");
const image = process.argv[3];
if (!image)
  throw new Error(
    "Usage: bun packages/e2e/src/perf/relay-reference-workload/workload.diagnostic.ts <output-directory> <built-relay-image>",
  );
await mkdir(output, { recursive: true });
const logs: string[] = [];
const log = (message: string) => {
  const entry = `${new Date().toISOString()} ${message}`;
  logs.push(entry);
  console.log(entry);
};
const cancellation = new AbortController();
const stop = () => cancellation.abort(new Error("Measurement interrupted"));
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
const hash = async (file: string) =>
  new Bun.CryptoHasher("sha256").update(await Bun.file(file).arrayBuffer()).digest("hex");
const root = resolve(import.meta.dir, "../../../../..");
const files = (await readdir(import.meta.dir)).filter((file) => file.endsWith(".ts"));
const hashes = Object.fromEntries(
  await Promise.all(files.map(async (file) => [file, await hash(join(import.meta.dir, file))])),
);
const source = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: root, stdout: "pipe" }).stdout.toString().trim();
const metadata = {
  measuredAt: new Date().toISOString(),
  source,
  dirty: Bun.spawnSync(["git", "status", "--porcelain"], { cwd: root, stdout: "pipe" }).stdout.length > 0,
  diagnosticHashes: hashes,
  cleanupOperatorSourceHash: await hash(join(root, "services/relay/src/runtime.ts")),
  bun: Bun.version,
  os: release(),
  arch: process.arch,
  cpu: cpus()[0]?.model,
  memoryBytes: totalmem(),
  deployment: "PS-786 Compose relay, PostgreSQL and RustFS; fixture-signed accounts; loopback ingress",
};
const main = async () => {
  const deployment = await deploy(image, log, cancellation.signal);
  const traffic = observeTraffic(deployment.origin);
  const results = [];
  const units = new Map<string, OwnerInput>();
  try {
    const provenance = {
      ...metadata,
      relayImage: await deployment.metadata(),
      cleanupOperatorBundleHash: deployment.operatorHash,
    };
    for (const name of ["reference", "scale"] as const) {
      log(`Starting ${name} workload`);
      const result = await runScenario({
        name,
        deployment,
        directory: join(output, "temporary-devices"),
        traffic,
        log,
        units,
      });
      results.push(result);
      await Bun.write(join(output, `${name}.json`), JSON.stringify({ metadata: provenance, ...result }, null, 2));
    }
    await Bun.write(
      join(output, "results.json"),
      JSON.stringify(
        {
          metadata: provenance,
          results,
          traffic: traffic.summary(),
          limitations: [
            "Local Docker/RustFS measurements do not establish hosted Spaces performance or capacity.",
            "Fixture-issued identities exercise relay authorization, not Google login or account-manager load.",
            "Response bytes are consumed application-body bytes, a lower bound excluding cancelled acknowledgments and HTTP/TLS overhead.",
            "No cloud resources or paid traffic were provisioned.",
          ],
        },
        null,
        2,
      ),
    );
    if (results.some((result) => !result.passed)) process.exitCode = 1;
  } finally {
    traffic.close();
    try {
      await Bun.write(
        join(output, "traffic.json"),
        JSON.stringify(
          {
            byteDefinition:
              "Request-body bytes offered to fetch; response-body bytes consumed by the client. Excludes cancelled responses and HTTP/TLS overhead.",
            summary: traffic.summary(),
            requests: traffic.samples,
          },
          null,
          2,
        ),
      );
    } finally {
      try {
        await deployment.close();
      } finally {
        await rm(join(output, "temporary-devices"), { recursive: true, force: true });
      }
    }
  }
};
try {
  await main();
} catch (error) {
  log(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  await Bun.write(
    join(output, "failure.json"),
    JSON.stringify({ metadata, error: error instanceof Error ? error.stack : String(error) }, null, 2),
  );
  process.exitCode = 1;
} finally {
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
  await Bun.write(join(output, "run.log"), logs.join("\n"));
}
