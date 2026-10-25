import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const directory = await mkdtemp(join(tmpdir(), "manager-authority-"));
const file = join(directory, "compose.json");
const project = `manager-authority-${crypto.randomUUID()}`;
const entries = process.argv.slice(2);
const compose = async (...args: string[]) => {
  const child = Bun.spawn(["docker", "compose", "-f", file, "-p", project, ...args], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await child.exited;
  if (status !== 0) throw new Error(`Isolated manager command failed (${status})`);
};
const config = {
  services: {
    database: {
      image: "postgres:16-alpine",
      environment: {
        POSTGRES_DB: "authority_admin",
        POSTGRES_USER: "fixture_admin",
        POSTGRES_PASSWORD: "fixture-admin-only",
      },
      healthcheck: {
        // Initialization accepts Unix-socket connections before the final TCP listener is ready.
        test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U fixture_admin -d authority_admin"],
        interval: "1s",
        timeout: "1s",
        retries: 20,
      },
    },
    tester: {
      image: "oven/bun:1.4.4",
      working_dir: "/repo/services/account-manager",
      volumes: [`${root}:/repo:ro`],
      environment: {
        MANAGER_TEST_ADMIN_URL: "postgres://fixture_admin:fixture-admin-only@database:5432/authority_admin",
      },
      command: ["bun", "test", ...(entries.length ? entries : ["src", "scripts"])],
      depends_on: { database: { condition: "service_healthy" } },
    },
    smoke: {
      build: { context: root, dockerfile: "services/account-manager/Dockerfile.smoke" },
      environment: {
        MANAGER_TEST_ADMIN_URL: "postgres://fixture_admin:fixture-admin-only@database:5432/authority_admin",
      },
      depends_on: { database: { condition: "service_healthy" } },
    },
  },
  networks: {
    default: { internal: true, ipam: { config: [{ subnet: process.env.MANAGER_TEST_SUBNET ?? "10.254.234.0/24" }] } },
  },
};
console.log(`Isolated manager stack: ${project}`);
try {
  await writeFile(file, JSON.stringify(config));
  await compose("up", "-d", "database");
  await compose("run", "--rm", "tester");
  await compose("build", "smoke");
  await compose("run", "--rm", "smoke");
  await compose("run", "--rm", "smoke", "bun", "test", "telemetry.test.js");
} finally {
  try {
    await compose("down", "--volumes", "--remove-orphans");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
