import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const dir = await mkdtemp(join(tmpdir(), "sync-contracts-compose-"));
const file = join(dir, "compose.json");
const project = `sync-contracts-${process.pid}`;
const requested = process.argv.slice(2);
const targets = (requested.length ? requested : ["src"]).map(
  (path) => `/repo/${relative(root, resolve(path)).replaceAll("\\", "/")}`,
);
const config = {
  services: {
    database: {
      image: "postgres:16-alpine",
      environment: { POSTGRES_DB: "conformance", POSTGRES_USER: "test", POSTGRES_PASSWORD: "isolated-test-only" },
      healthcheck: {
        test: ["CMD-SHELL", "pg_isready -U test -d conformance"],
        interval: "1s",
        timeout: "1s",
        retries: 20,
      },
    },
    objects: {
      image: "rustfs/rustfs:1.0.1",
      environment: {
        RUSTFS_ACCESS_KEY: "conformance-access",
        RUSTFS_SECRET_KEY: "conformance-secret-only",
        RUSTFS_CONSOLE_ENABLE: "false",
      },
      command: ["/data"],
      volumes: ["objects:/data"],
    },
    tester: {
      image: "oven/bun:1.4.4",
      working_dir: "/repo/packages/pstdio-sync-contracts",
      volumes: [`${root}:/repo:ro`],
      environment: {
        SYNC_TEST_DATABASE_URL: "postgres://test:isolated-test-only@database:5432/conformance",
        SYNC_TEST_OBJECT_ENDPOINT: "http://objects:9000",
        TEST_PRIORITIES: process.env.TEST_PRIORITIES ?? "P1",
        CI_PRIORITY: process.env.CI_PRIORITY ?? "P1",
        // Docker injects a configured client proxy into every container. The services and the
        // tests' own loopback servers are local, so their requests must never go through that proxy.
        NO_PROXY: "database,objects,127.0.0.1,localhost",
        no_proxy: "database,objects,127.0.0.1,localhost",
      },
      command: ["bun", "scripts/run-conformance.ts", ...targets],
      depends_on: { database: { condition: "service_healthy" }, objects: { condition: "service_started" } },
    },
  },
  volumes: { objects: {} },
  networks: { default: { ipam: { config: [{ subnet: process.env.SYNC_TEST_SUBNET ?? "10.254.236.0/24" }] } } },
};
async function compose(...args: string[]) {
  const process = Bun.spawn(["docker", "compose", "-f", file, "-p", project, ...args], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await process.exited;
  if (code !== 0) throw new Error(`Isolated conformance command failed (${code})`);
}
try {
  await writeFile(file, JSON.stringify(config));
  await compose("up", "-d", "database", "objects");
  await compose("run", "--rm", "tester");
} finally {
  try {
    await compose("down", "--volumes", "--remove-orphans");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
