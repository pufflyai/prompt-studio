import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const project = `pstdio-portable-${crypto.randomUUID()}`;
const directory = await mkdtemp(join(tmpdir(), project));
const env = {
  ...process.env,
  RELAY_IMAGE: `${project}-relay`,
  MANAGER_IMAGE: `${project}-manager`,
  RELAY_DOMAIN: "relay.fixture.test",
  MANAGER_DOMAIN: "authority",
  RELAY_DB_PASSWORD: "relay_portable_fixture_only",
  MANAGER_DB_PASSWORD: "manager_portable_fixture_only",
  S3_ACCESS_KEY_ID: "relay_test_access",
  S3_SECRET_ACCESS_KEY: "relay_test_secret_key",
  BETTER_AUTH_SECRET: "owned-bundled-manager-fixture-secret-0123456789",
  GOOGLE_CLIENT_ID: "owned-fixture-client",
  GOOGLE_CLIENT_SECRET: "owned-fixture-secret",
  RELAY_ACCESS_TRUST: "{}",
  RELAY_RECOVERY_KEY: Buffer.alloc(32).toString("base64"),
};
let active: ReturnType<typeof Bun.spawn> | undefined;
const interrupt = () => active?.kill("SIGTERM");
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);
async function run(args: string[], capture = false) {
  const child = Bun.spawn(args, { cwd: root, env, stdout: capture ? "pipe" : "inherit", stderr: "inherit" });
  active = child;
  const output = capture ? new Response(child.stdout).text() : Promise.resolve("");
  const status = await child.exited;
  active = undefined;
  if (status !== 0) throw new Error(`Portable smoke failed: ${args.join(" ")}`);
  return output;
}

// Use the actual deployment topology and migration jobs. Only public ingress and
// operator inputs are replaced by the existing owned HTTPS/authentication fixtures.
const config = JSON.parse(
  await run(
    ["docker", "compose", "--profile", "setup", "-f", "infra/relay/compose.yaml", "config", "--format", "json"],
    true,
  ),
);
const fixtures = JSON.parse(
  await run(
    ["docker", "compose", "--profile", "test", "-f", "infra/relay/compose.test.yaml", "config", "--format", "json"],
    true,
  ),
);
delete config.services.ingress;
delete config.volumes["ingress-data"];
delete config.volumes["ingress-config"];
const relayUrl = config.services.relay.environment.DATABASE_URL;
const managerUrl = config.services.manager.environment.DATABASE_URL;
const runtimeRelayUrl = relayUrl.replace("relay:relay_portable_fixture_only", "relay_runtime:runtime_fixture_only");
const runtimeManagerUrl = managerUrl.replace(
  "manager:manager_portable_fixture_only",
  "manager_runtime:runtime_fixture_only",
);
config.services.relay.environment.DATABASE_URL = runtimeRelayUrl;
config.services["relay-migrate"].command = [
  "bun",
  "container-entrypoint.ts",
  "bun",
  "database-migration.js",
  "./storage.js",
  "migrateRelayStorage",
  "relay_runtime",
];
config.services["manager-migrate"].command = [
  "bun",
  "container-entrypoint.ts",
  "bun",
  "dist/database-migration.js",
  "./dist/index.js",
  "migrateAccountManager",
  "manager_runtime",
];
config.services.relay.build = { context: root, dockerfile: "infra/relay/Dockerfile", target: "runtime" };
config.services.manager.build = { context: root, dockerfile: "infra/account-manager/Dockerfile" };
for (const name of ["smoke", "initialize", "tls"]) {
  config.services[name] = fixtures.services[name];
  config.services[name].networks = { edge: {}, relay: {}, manager: {} };
}
config.volumes = { ...config.volumes, ...fixtures.volumes };
for (const volume of Object.values(config.volumes)) delete (volume as { name?: string }).name;
for (const network of Object.values(config.networks)) delete (network as { name?: string }).name;
for (const [index, name] of ["edge", "relay", "manager"].entries()) {
  config.networks[name].ipam = {
    config: [
      { subnet: process.env[`PORTABLE_TEST_${name.toUpperCase()}_SUBNET`] ?? `10.254.${[241, 242, 244][index]}.0/24` },
    ],
  };
}
for (const name of ["smoke", "initialize"]) {
  Object.assign(config.services[name].environment, {
    DATABASE_URL: relayUrl,
    MANAGER_DATABASE_URL: managerUrl,
    S3_BUCKET: "relay",
  });
}
delete config.services.initialize.environment.FIXTURE_ADMIN_URL;
config.services.manager.environment = { ...fixtures.services.authority.environment, DATABASE_URL: runtimeManagerUrl };
config.services.manager.volumes = fixtures.services.authority.volumes;
config.services.manager.networks.edge = { aliases: ["authority"] };
config.services.manager.healthcheck = fixtures.services.authority.healthcheck;
delete config.services.relay.environment.RELAY_ACCESS_TRUST;
delete config.services.relay.environment.RELAY_RECOVERY_KEY;
Object.assign(config.services.relay.environment, {
  RELAY_ACCESS_TRUST_FILE: "/access-trust/trust.json",
  RELAY_RECOVERY_KEY_FILE: "/recovery/key",
});
config.services.relay.volumes = fixtures.services.relay.volumes;
config.services.relay.healthcheck = fixtures.services.relay.healthcheck;
const path = join(directory, "compose.json");
await Bun.write(path, JSON.stringify(config));
const compose = ["docker", "compose", "-p", project, "-f", path];
console.log(`Portable deployment smoke: ${project}`);
try {
  await run([...compose, "build", "relay", "manager", "tls", "initialize", "smoke"]);
  await run([...compose, "run", "--rm", "--no-deps", "tls"]);
  await run([...compose, "up", "-d", "--wait", "relay-db", "manager-db", "objects"]);
  for (const name of ["relay", "manager"]) {
    await run([
      ...compose,
      "exec",
      "-T",
      `${name}-db`,
      "psql",
      "-U",
      name,
      "-d",
      name,
      "-c",
      `CREATE ROLE ${name}_runtime LOGIN PASSWORD 'runtime_fixture_only'`,
    ]);
  }
  await run([...compose, "run", "--rm", "bucket"]);
  await run([...compose, "run", "--rm", "relay-migrate"]);
  await run([...compose, "run", "--rm", "manager-migrate"]);
  await run([...compose, "run", "--rm", "--no-deps", "initialize"]);
  await run([...compose, "up", "-d", "--wait", "relay", "manager"]);
  await run([...compose, "run", "--rm", "--no-deps", "smoke"]);
  await run([...compose, "up", "-d", "--wait", "--force-recreate", "relay", "manager"]);
  await run([...compose, "run", "--rm", "--no-deps", "smoke", "bun", "smoke-replacement.js"]);
  console.log("Portable deployment migration, content and auth persistence passed");
} catch (error) {
  await run([...compose, "logs", "--no-color"]);
  throw error;
} finally {
  await run([...compose, "--profile", "test", "--profile", "setup", "down", "--volumes", "--remove-orphans"]);
  await rm(directory, { recursive: true, force: true });
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", interrupt);
}
